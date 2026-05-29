// Matches NearbyNetwork.kt in plain-app (Android): same multicast group, port,
// and message prefix protocol used by NearbyDiscoverManager.
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::net::{Ipv4Addr, SocketAddrV4, UdpSocket};
use std::time::{Duration, Instant};

use if_addrs::{IfAddr, Interface};

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
        if priv_lan {
            0
        } else {
            1
        }
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
