use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::net::{Ipv4Addr, SocketAddrV4, UdpSocket};
use std::time::{Duration, Instant};

use if_addrs::{IfAddr, Interface};

// Matches NearbyNetwork.kt in plain-app (Android): same multicast group, port,
// and message prefix protocol used by NearbyDiscoverManager.
const MULTICAST_ADDR: Ipv4Addr = Ipv4Addr::new(224, 0, 0, 100);
const NEARBY_PORT: u16 = 52352;
const DISCOVER_PREFIX: &str = "DISCOVER:";
const DISCOVER_REPLY_PREFIX: &str = "DISCOVER_REPLY:";
const SCAN_TIMEOUT_MS: u64 = 2500;
const RECV_BUF_SIZE: usize = 4096;

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveredDevice {
    pub id: String,
    pub name: String,
    pub host: String,
    pub ip: String,
    pub port: u16,
    pub device_type: String,
}

#[derive(Deserialize, Debug)]
struct DiscoverReply {
    id: String,
    name: String,
    port: u16,
    #[serde(default)]
    ips: Vec<String>,
    #[serde(default, alias = "deviceType")]
    device_type: String,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "snake_case")]
pub enum DiscoverScanStatus {
    Ok,
    PermissionDenied,
    NetworkError,
}

#[derive(Serialize, Clone, Debug)]
pub struct DiscoverDevicesResult {
    pub devices: Vec<DiscoveredDevice>,
    pub status: DiscoverScanStatus,
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct MacosNotificationOptions {
    title: String,
    body: Option<String>,
}

#[cfg(target_os = "macos")]
#[tauri::command]
pub async fn send_macos_notification(
    app: tauri::AppHandle,
    options: MacosNotificationOptions,
) -> Result<(), String> {
    let identifier = app.config().identifier.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let plain_script =
            macos_notification_script(&options.title, options.body.as_deref());
        let script = format!(
            "tell application id {}\n{}\nend tell",
            applescript_string(&identifier),
            plain_script
        );
        run_osascript(&script)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(target_os = "macos")]
fn macos_notification_script(title: &str, body: Option<&str>) -> String {
    format!(
        "display notification {} with title {}",
        applescript_string(body.unwrap_or("")),
        applescript_string(title)
    )
}

#[cfg(target_os = "macos")]
fn run_osascript(script: &str) -> Result<(), String> {
    let status = std::process::Command::new("osascript")
        .arg("-e")
        .arg(script)
        .status()
        .map_err(|e| e.to_string())?;
    if status.success() {
        Ok(())
    } else {
        Err(format!("osascript exited with status {status}"))
    }
}

#[cfg(target_os = "macos")]
fn applescript_string(value: &str) -> String {
    let escaped = value
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace(['\r', '\n'], " ");
    format!("\"{escaped}\"")
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub async fn send_macos_notification(_options: MacosNotificationOptions) -> Result<(), String> {
    Err("macOS notifications are only available on macOS".to_string())
}

#[tauri::command]
pub async fn discover_devices() -> DiscoverDevicesResult {
    tauri::async_runtime::spawn_blocking(scan_blocking)
        .await
        .unwrap_or_else(|_| DiscoverDevicesResult {
            devices: vec![],
            status: DiscoverScanStatus::NetworkError,
        })
}

fn scan_blocking() -> DiscoverDevicesResult {
    // Empty discover request — matches DDiscoverRequest() with default empty fields.
    let payload = format!("{DISCOVER_PREFIX}{{}}");
    let target = SocketAddrV4::new(MULTICAST_ADDR, NEARBY_PORT);

    // On multi-homed hosts (Wi-Fi + VPN, Wi-Fi + Ethernet, Docker, VMware, …)
    // a plain `send_to` against a multicast address goes out the kernel's
    // default multicast interface, which is often *not* the LAN where the
    // phone lives. We bind one socket per local IPv4 interface — binding the
    // local address forces the kernel to use that interface for outgoing
    // multicast (equivalent to setting IP_MULTICAST_IF). Android replies via
    // NearbyNetwork.sendUnicast(message, targetIP), which always sends back to
    // NEARBY_PORT rather than the UDP source port. Therefore Tauri must bind
    // the receive sockets to NEARBY_PORT, not ephemeral ports.
    let interfaces = if_addrs::get_if_addrs().unwrap_or_default();
    let mut bind_addrs: Vec<Ipv4Addr> = local_ipv4_addrs(&interfaces);
    if bind_addrs.is_empty() {
        // No usable interfaces — fall back to letting the kernel pick.
        bind_addrs.push(Ipv4Addr::UNSPECIFIED);
    }

    let mut sockets: Vec<UdpSocket> = Vec::with_capacity(bind_addrs.len());
    let mut saw_permission_denied = false;
    for ip in bind_addrs {
        let socket = match UdpSocket::bind(SocketAddrV4::new(ip, NEARBY_PORT)) {
            Ok(s) => s,
            Err(e) => {
                if e.kind() == std::io::ErrorKind::PermissionDenied {
                    saw_permission_denied = true;
                }
                continue;
            }
        };
        let _ = socket.set_multicast_ttl_v4(1);
        let _ = socket.set_multicast_loop_v4(true);
        // Short non-blocking-ish read so we can round-robin across sockets
        // and honour the overall scan deadline.
        let _ = socket.set_read_timeout(Some(Duration::from_millis(100)));
        match socket.send_to(payload.as_bytes(), target) {
            Ok(_) => {}
            Err(e) => {
                if e.kind() == std::io::ErrorKind::PermissionDenied {
                    saw_permission_denied = true;
                }
                continue;
            }
        }
        sockets.push(socket);
    }
    if sockets.is_empty() {
        return DiscoverDevicesResult {
            devices: vec![],
            status: if saw_permission_denied {
                DiscoverScanStatus::PermissionDenied
            } else {
                DiscoverScanStatus::NetworkError
            },
        };
    }

    // Collect unique replies by device id within the scan window. Replies are
    // unicast back to whichever probe socket was used to send the request, so
    // we round-robin across all sockets until the deadline is reached.
    let mut found: HashMap<String, DiscoveredDevice> = HashMap::new();
    let mut buf = [0u8; RECV_BUF_SIZE];
    let deadline = Instant::now() + Duration::from_millis(SCAN_TIMEOUT_MS);

    while Instant::now() < deadline {
        let mut got_any = false;
        for socket in &sockets {
            if Instant::now() >= deadline {
                break;
            }
            match socket.recv_from(&mut buf) {
                Ok((n, src)) => {
                    got_any = true;
                    let msg = match std::str::from_utf8(&buf[..n]) {
                        Ok(s) => s,
                        Err(_) => continue,
                    };
                    let json = match msg.strip_prefix(DISCOVER_REPLY_PREFIX) {
                        Some(j) => j,
                        None => continue,
                    };
                    let reply: DiscoverReply = match serde_json::from_str(json) {
                        Ok(r) => r,
                        Err(_) => continue,
                    };
                    // Prefer the IP that actually answered us; fall back to
                    // the first advertised IPv4 in the reply.
                    let host_ip = if let std::net::IpAddr::V4(v4) = src.ip() {
                        v4.to_string()
                    } else {
                        reply
                            .ips
                            .iter()
                            .find(|s| s.parse::<Ipv4Addr>().is_ok())
                            .cloned()
                            .unwrap_or_default()
                    };
                    if host_ip.is_empty() {
                        continue;
                    }
                    found.entry(reply.id.clone()).or_insert(DiscoveredDevice {
                        id: reply.id.clone(),
                        name: reply.name.clone(),
                        host: format!("{host_ip}:{}", reply.port),
                        ip: host_ip.clone(),
                        port: reply.port,
                        device_type: normalize_device_type(&reply.device_type),
                    });
                }
                Err(_) => {
                    // No packet within this socket's read timeout, or transient
                    // recv error — round-robin to the next socket.
                }
            }
        }
        // If every socket timed out this round, yield briefly so we don't
        // spin a tight loop.
        if !got_any {
            std::thread::sleep(Duration::from_millis(20));
        }
    }

    DiscoverDevicesResult {
        devices: found.into_values().collect(),
        status: DiscoverScanStatus::Ok,
    }
}

/// Return all non-loopback, non-link-local IPv4 addresses bound to local
/// interfaces, in priority order (private LAN ranges first). Used to send a
/// multicast probe out of every interface so we don't get blackholed by the
/// kernel's default multicast route on multi-homed hosts.
fn local_ipv4_addrs(interfaces: &[Interface]) -> Vec<Ipv4Addr> {
    let mut addrs: Vec<Ipv4Addr> = interfaces
        .iter()
        .filter_map(|iface| match &iface.addr {
            IfAddr::V4(v4) => Some(v4.ip),
            _ => None,
        })
        .filter(|ip| !ip.is_loopback() && !ip.is_link_local() && !ip.is_unspecified())
        .collect();

    // Stable de-dup while preserving order.
    let mut seen = std::collections::HashSet::new();
    addrs.retain(|ip| seen.insert(*ip));

    // Prefer typical LAN ranges (where the phone almost certainly lives) over
    // VPN/CGNAT-style addresses so the right interface gets used first even
    // when the kernel later picks one for `IP_MULTICAST_IF` lookups.
    addrs.sort_by_key(|ip| {
        let o = ip.octets();
        let priv_lan = ip.is_private() && !is_cgnat(&o);
        if priv_lan { 0 } else { 1 }
    });
    addrs
}

fn is_cgnat(o: &[u8; 4]) -> bool {
    // 100.64.0.0/10 — RFC 6598 carrier-grade NAT, often used by VPNs.
    o[0] == 100 && (o[1] & 0xC0) == 64
}

fn normalize_device_type(wire: &str) -> String {
    match wire {
        "COMPUTER" => "computer".to_string(),
        "PHONE" => "phone".to_string(),
        "TABLET" => "tablet".to_string(),
        "TV" => "tv".to_string(),
        "OTHER" => "other".to_string(),
        v => v.to_string(),
    }
}

// ─── IPC fetch command (bypasses WKWebView TLS validation) ──────────────────
//
// JS passes: raw request body as ArrayBuffer IPC body, plus IPC headers:
//   x-url     — target URL
//   x-method  — HTTP method
//   x-headers — JSON-encoded extra request headers (Record<string,string>)
//
// Response: tauri::ipc::Response whose bytes are [status_hi, status_lo, ...body]
// No base64 — bytes flow through the proxy untouched.
//
// A single HttpClient is shared across all requests (Tauri state) so that
// TCP connections and TLS sessions are reused — this is critical for latency.
// reqwest::Client is internally an Arc, so cloning is cheap.

pub struct HttpClient(pub reqwest::Client);

impl HttpClient {
    pub fn new() -> Self {
        let client = reqwest::Client::builder()
            .danger_accept_invalid_certs(true)
            .danger_accept_invalid_hostnames(true)
            .tcp_keepalive(std::time::Duration::from_secs(30))
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .expect("reqwest client init failed");
        HttpClient(client)
    }
}

#[tauri::command]
pub async fn http_request(
    http: tauri::State<'_, HttpClient>,
    request: tauri::ipc::Request<'_>,
) -> Result<tauri::ipc::Response, String> {
    let hdrs = request.headers();
    let url = hdrs
        .get("x-url")
        .and_then(|v| v.to_str().ok())
        .ok_or("missing x-url header")?
        .to_string();
    let method: reqwest::Method = hdrs
        .get("x-method")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("POST")
        .parse()
        .map_err(|_| "invalid method")?;
    let extra_headers: HashMap<String, String> = hdrs
        .get("x-headers")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| serde_json::from_str(s).ok())
        .unwrap_or_default();

    let body = match request.body() {
        tauri::ipc::InvokeBody::Raw(b) => b.clone(),
        tauri::ipc::InvokeBody::Json(_) => vec![],
    };

    let mut builder = http.0.request(method, &url);
    for (k, v) in extra_headers {
        builder = builder.header(&k, &v);
    }
    if !body.is_empty() {
        builder = builder.body(body);
    }

    let resp = builder.send().await.map_err(|e| e.to_string())?;
    let status = resp.status().as_u16();
    let resp_bytes = resp.bytes().await.map_err(|e| e.to_string())?;

    // Prepend 2 bytes (big-endian u16) for the HTTP status code so JS can read it.
    let mut out = Vec::with_capacity(2 + resp_bytes.len());
    out.push((status >> 8) as u8);
    out.push((status & 0xff) as u8);
    out.extend_from_slice(&resp_bytes);
    Ok(tauri::ipc::Response::new(out))
}

// ─── WebSocket local-proxy (bypasses WKWebView TLS validation) ───────────────
//
// Instead of routing WS frames through Tauri IPC events, Rust opens a plain
// (non-TLS) TCP listener on 127.0.0.1:0 and returns the assigned port to JS.
// JS then does:  new WebSocket('ws://127.0.0.1:<port>')
// Rust accepts that connection, upgrades it to WS, then connects to the real
// device WSS URL with danger_accept_invalid_certs and relays frames in both
// directions. No custom IPC serialisation — TCP carries the data directly.

#[tauri::command]
pub async fn ws_start_proxy(url: String) -> Result<u16, String> {
    use tokio::net::TcpListener;
    use futures_util::SinkExt;

    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();

    tauri::async_runtime::spawn(async move {
        // Accept exactly one connection from JS (each WebSocket gets its own proxy).
        let Ok((tcp, _)) = listener.accept().await else { return };

        // Handshake local side (plain WS — no TLS needed for localhost).
        let Ok(mut local_ws) = tokio_tungstenite::accept_async(tcp).await else { return };

        // Connect to device with self-signed cert acceptance.
        let tls = match native_tls::TlsConnector::builder()
            .danger_accept_invalid_certs(true)
            .build()
        {
            Ok(t) => t,
            Err(_) => return,
        };
        let connector = tokio_tungstenite::Connector::NativeTls(tls);
        let Ok((device_ws, _)) = tokio_tungstenite::connect_async_tls_with_config(
            url.as_str(),
            None,
            false,
            Some(connector),
        )
        .await
        else {
            // Ensure frontend receives a close event when remote connection fails.
            let _ = local_ws.close(None).await;
            return;
        };

        use futures_util::StreamExt;
        let (mut local_tx, mut local_rx) = local_ws.split();
        let (mut device_tx, mut device_rx) = device_ws.split();

        // Relay frames in both directions until either side closes.
        tokio::select! {
            _ = async {
                while let Some(Ok(msg)) = local_rx.next().await {
                    if device_tx.send(msg).await.is_err() { break; }
                }
            } => {}
            _ = async {
                while let Some(Ok(msg)) = device_rx.next().await {
                    if local_tx.send(msg).await.is_err() { break; }
                }
            } => {}
        }

        // Signal closure to frontend after relay exits for any reason.
        let _ = local_tx.close().await;
    });

    Ok(port)
}
