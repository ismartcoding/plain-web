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
pub struct DiscoveredDevice {
    pub name: String,
    pub host: String,
    pub port: u16,
}

#[derive(Deserialize, Debug)]
struct DiscoverReply {
    id: String,
    name: String,
    port: u16,
    #[serde(default)]
    ips: Vec<String>,
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
    log::info!(
        "discover_devices: start scan target={target} payload_len={} timeout_ms={}",
        payload.len(),
        SCAN_TIMEOUT_MS
    );

    // On multi-homed hosts (Wi-Fi + VPN, Wi-Fi + Ethernet, Docker, VMware, …)
    // a plain `send_to` against a multicast address goes out the kernel's
    // default multicast interface, which is often *not* the LAN where the
    // phone lives. We bind one socket per local IPv4 interface — binding the
    // local address forces the kernel to use that interface for outgoing
    // multicast (equivalent to setting IP_MULTICAST_IF) — and reuse those
    // same sockets to receive the unicast replies. Replies arrive at the
    // ephemeral port the probe was sent from, so the listening socket *must*
    // be the same socket that did the send.
    let interfaces = if_addrs::get_if_addrs().unwrap_or_default();
    let mut bind_addrs: Vec<Ipv4Addr> = local_ipv4_addrs(&interfaces);
    if bind_addrs.is_empty() {
        // No usable interfaces — fall back to letting the kernel pick.
        bind_addrs.push(Ipv4Addr::UNSPECIFIED);
    }

    let mut sockets: Vec<UdpSocket> = Vec::with_capacity(bind_addrs.len());
    let mut saw_permission_denied = false;
    let mut send_ok_count = 0usize;
    let mut send_fail_count = 0usize;
    for ip in bind_addrs {
        let socket = match UdpSocket::bind(SocketAddrV4::new(ip, 0)) {
            Ok(s) => s,
            Err(e) => {
                if e.kind() == std::io::ErrorKind::PermissionDenied {
                    saw_permission_denied = true;
                }
                log::warn!("discover_devices: bind on {ip} failed: {e}");
                continue;
            }
        };
        if let Err(e) = socket.set_multicast_ttl_v4(1) {
            log::warn!("discover_devices: set_multicast_ttl_v4 via {ip} failed: {e}");
        }
        if let Err(e) = socket.set_multicast_loop_v4(true) {
            log::warn!("discover_devices: set_multicast_loop_v4 via {ip} failed: {e}");
        }
        // Short non-blocking-ish read so we can round-robin across sockets
        // and honour the overall scan deadline.
        if let Err(e) = socket.set_read_timeout(Some(Duration::from_millis(100))) {
            log::warn!("discover_devices: set_read_timeout via {ip} failed: {e}");
        }
        let local_addr = socket.local_addr().ok();
        match socket.send_to(payload.as_bytes(), target) {
            Ok(n) => {
                send_ok_count += 1;
                log::info!(
                    "discover_devices: probe sent via ip={ip} local={:?} target={target} bytes={n}",
                    local_addr
                );
            }
            Err(e) => {
                send_fail_count += 1;
                if e.kind() == std::io::ErrorKind::PermissionDenied {
                    saw_permission_denied = true;
                }
                log::warn!(
                    "discover_devices: send failed via ip={ip} local={:?} target={target}: {e}",
                    local_addr
                );
                continue;
            }
        }
        sockets.push(socket);
    }
    log::info!(
        "discover_devices: send summary ok={} fail={} active_sockets={}",
        send_ok_count,
        send_fail_count,
        sockets.len()
    );
    if sockets.is_empty() {
        log::error!("discover_devices: every interface failed to send multicast");
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
                    log::debug!("discover_devices: packet received from {src}, bytes={n}");
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
                        Err(e) => {
                            log::warn!("discover_devices: bad reply json: {e}");
                            continue;
                        }
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
                        name: reply.name.clone(),
                        host: format!("{host_ip}:{}", reply.port),
                        port: reply.port,
                    });
                    log::info!(
                        "discover_devices: discovered device id={} name={} host={} port={}",
                        reply.id,
                        reply.name,
                        host_ip,
                        reply.port
                    );
                }
                Err(e)
                    if e.kind() == std::io::ErrorKind::WouldBlock
                        || e.kind() == std::io::ErrorKind::TimedOut =>
                {
                    // No packet within this socket's read timeout — try the next.
                }
                Err(e) => {
                    log::warn!("discover_devices: recv error: {e}");
                }
            }
        }
        // If every socket timed out this round, yield briefly so we don't
        // spin a tight loop.
        if !got_any {
            std::thread::sleep(Duration::from_millis(20));
        }
    }

    log::info!(
        "discover_devices: scan completed, devices_found={}",
        found.len()
    );

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
