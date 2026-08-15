//! Lightweight mDNS responder — single receive socket, standards-aware reply.
//! Translated from plain-app `MdnsHostResponder.kt`.
//!
//! RECEIVE: One socket bound to 0.0.0.0:5353 joins 224.0.0.251 on every valid
//! LAN interface.
//!
//! SEND: Replies are sent via the same socket so the source port is always
//! 5353. RFC 6762 §6.7 requires this — resolvers silently discard mDNS
//! responses whose source port ≠ 5353. QU/legacy-unicast queries are answered
//! directly; ordinary multicast queries are answered to 224.0.0.251:5353.

use super::packet_codec::{self, MdnsResponse};
use super::service_info::MdnsServiceInfo;
use super::service_response_builder;
use if_addrs::{IfAddr, Interface};
use std::io;
use std::net::{Ipv4Addr, SocketAddrV4};
use std::sync::{
    Arc, RwLock,
    atomic::{AtomicBool, Ordering},
};
use std::time::Duration;

const MDNS_GROUP: Ipv4Addr = Ipv4Addr::new(224, 0, 0, 251);
const MDNS_PORT: u16 = 5353;
const RECEIVE_TIMEOUT_MS: u64 = 1_000;
const RECV_BUF_SIZE: usize = 1500;

pub(crate) type PacketListener = Arc<dyn Fn(&[u8], &str) + Send + Sync>;

struct Inner {
    hostname: RwLock<String>,
    service_info: RwLock<Option<MdnsServiceInfo>>,
    socket: RwLock<Option<Arc<std::net::UdpSocket>>>,
    running: AtomicBool,
    listeners: RwLock<Vec<PacketListener>>,
}

static INNER: Inner = Inner {
    hostname: RwLock::new(String::new()),
    service_info: RwLock::new(None),
    socket: RwLock::new(None),
    running: AtomicBool::new(false),
    listeners: RwLock::new(Vec::new()),
};

pub(crate) fn is_running() -> bool {
    INNER.running.load(Ordering::SeqCst) && INNER.socket.read().unwrap().is_some()
}

/// Starts the mDNS responder. `service` advertises the PlainApp service
/// (PTR/SRV/TXT/A answers); when None the responder only answers A-record
/// queries for `mdns_hostname`.
pub(crate) fn start(mdns_hostname: &str, service: Option<MdnsServiceInfo>) -> bool {
    let normalized = normalize_hostname(mdns_hostname);
    if normalized.is_empty() {
        log::error!("mDNS start skipped: empty hostname");
        return false;
    }
    *INNER.hostname.write().unwrap() = normalized;
    *INNER.service_info.write().unwrap() = service;
    restart_socket()
}

/// Ensures the responder socket is up so discovery works even while the HTTP
/// service is off. When already running this keeps the current configuration.
pub(crate) fn ensure_started(mdns_hostname: &str) -> bool {
    if is_running() {
        return true;
    }
    let service = INNER.service_info.read().unwrap().clone();
    start(mdns_hostname, service)
}

#[allow(dead_code)]
pub(crate) fn stop() {
    tear_down_socket();
    *INNER.hostname.write().unwrap() = String::new();
    *INNER.service_info.write().unwrap() = None;
}

/// Withdraws the `_plainapp` service advertisement while KEEPING the socket
/// and hostname responder alive. Called when the HTTP service stops: the
/// shared socket must survive so a running browser keeps querying, and the
/// responder keeps answering A queries for the hostname. Use [`stop`] only
/// for a full teardown.
#[allow(dead_code)]
pub(crate) fn clear_service() {
    *INNER.service_info.write().unwrap() = None;
    log::debug!("mDNS service advertisement withdrawn, socket kept for hostname/browser");
}

/// Recreates the socket, preserving hostname/service config.
pub(crate) fn restart_socket() -> bool {
    tear_down_socket();
    let hostname = INNER.hostname.read().unwrap().clone();
    if hostname.is_empty() {
        return false;
    }

    let candidates = candidate_interfaces();
    if candidates.is_empty() {
        log::error!("mDNS: no candidate interfaces found");
        return false;
    }

    let socket = match create_mdns_socket() {
        Ok(s) => s,
        Err(e) => {
            log::error!("mDNS socket create failed: {e}");
            return false;
        }
    };

    if let Err(e) = socket.bind(&SocketAddrV4::new(Ipv4Addr::UNSPECIFIED, MDNS_PORT).into()) {
        let _ = std::net::UdpSocket::from(socket);
        log::error!("mDNS bind/join failed: {e}");
        return false;
    }
    let socket: std::net::UdpSocket = socket.into();
    let socket = Arc::new(socket);
    let mut joined = false;
    for iface in &candidates {
        match socket.join_multicast_v4(&MDNS_GROUP, &iface.ip) {
            Ok(()) => {
                joined = true;
                log::debug!("mDNS joined {}", iface.name);
            }
            Err(e) => log::error!("mDNS joinGroup {}: {e}", iface.name),
        }
    }
    if !joined {
        match socket.join_multicast_v4(&MDNS_GROUP, &Ipv4Addr::UNSPECIFIED) {
            Ok(()) => log::debug!("mDNS joined (default)"),
            Err(e) => log::error!("mDNS joinGroup default: {e}"),
        }
    }

    *INNER.socket.write().unwrap() = Some(socket.clone());
    INNER.running.store(true, Ordering::SeqCst);
    let worker = Worker { socket };
    std::thread::Builder::new()
        .name("plain-mdns-responder".to_string())
        .spawn(move || worker.run_loop())
        .expect("spawn mdns responder");
    log::debug!(
        "mDNS responder started for {hostname} on {} interface(s)",
        candidates.len()
    );
    true
}

fn tear_down_socket() {
    INNER.running.store(false, Ordering::SeqCst);
    let s = INNER.socket.write().unwrap().take();
    if let Some(s) = s {
        let _ = s.leave_multicast_v4(&MDNS_GROUP, &Ipv4Addr::UNSPECIFIED);
        // Drop closes the socket; the worker's recv times out and exits.
    }
}

/// Registers a listener for every inbound mDNS packet; survives socket restarts.
pub(crate) fn add_packet_listener(listener: PacketListener) {
    let mut listeners = INNER.listeners.write().unwrap();
    if !listeners.iter().any(|l| Arc::ptr_eq(l, &listener)) {
        listeners.push(listener);
    }
}

pub(crate) fn remove_packet_listener(listener: &PacketListener) {
    INNER.listeners
        .write()
        .unwrap()
        .retain(|l| !Arc::ptr_eq(l, listener));
}

/// Sends an mDNS query through the shared socket so responses come back on
/// port 5353 (RFC 6762 §6.7 requires the source port to be 5353).
pub(crate) fn send_query(bytes: &[u8]) {
    let Some(socket) = INNER.socket.read().unwrap().clone() else {
        return;
    };
    if let Some(iface) = candidate_interfaces().into_iter().next() {
        let _ = socket2::SockRef::from(&*socket).set_multicast_if_v4(&iface.ip);
    }
    let target = SocketAddrV4::new(MDNS_GROUP, MDNS_PORT);
    if let Err(e) = socket.send_to(bytes, target) {
        log::error!("mDNS sendQuery: {e}");
    }
}

fn notify_packet_listeners(bytes: &[u8], sender_ip: &str) {
    let listeners = INNER.listeners.read().unwrap().clone();
    for l in listeners {
        l(bytes, sender_ip);
    }
}

struct Worker {
    socket: Arc<std::net::UdpSocket>,
}

impl Worker {
    fn run_loop(&self) {
        let _ = self
            .socket
            .set_read_timeout(Some(Duration::from_millis(RECEIVE_TIMEOUT_MS)));
        let mut buf = [0u8; RECV_BUF_SIZE];
        loop {
            match self.socket.recv_from(&mut buf) {
                Ok((n, src)) => {
                    let sender_ip = match src.ip() {
                        std::net::IpAddr::V4(v4) => v4.to_string(),
                        std::net::IpAddr::V6(_) => continue,
                    };
                    let packet = buf[..n].to_vec();
                    notify_packet_listeners(&packet, &sender_ip);
                    let fresh = candidate_interfaces();
                    if fresh.is_empty() {
                        continue;
                    }
                    let Some((response_iface, local_ip)) = find_response_iface(&sender_ip, &fresh)
                    else {
                        continue;
                    };
                    let Some(response) = build_response(&packet, &[local_ip.clone()]) else {
                        continue;
                    };
                    let use_unicast =
                        response.unicast_response_requested() || src.port() != MDNS_PORT;
                    let dest = if use_unicast {
                        src
                    } else {
                        std::net::SocketAddr::V4(SocketAddrV4::new(MDNS_GROUP, MDNS_PORT))
                    };
                    let send_result = (|| -> io::Result<()> {
                        if !use_unicast {
                            socket2::SockRef::from(&*self.socket)
                                .set_multicast_if_v4(&response_iface.ip)?;
                        }
                        self.socket.send_to(&response.bytes, dest)?;
                        Ok(())
                    })();
                    match send_result {
                        Ok(()) => {
                            let hostname = INNER.hostname.read().unwrap().clone();
                            log::debug!(
                                "mDNS reply {hostname} → {local_ip} from {sender_ip}:{} dest={dest}",
                                src.port()
                            );
                        }
                        Err(e) => log::error!("mDNS send to {sender_ip}: {e}"),
                    }
                }
                Err(err)
                    if err.kind() == io::ErrorKind::WouldBlock
                        || err.kind() == io::ErrorKind::TimedOut => {}
                Err(err) => {
                    if !INNER.running.load(Ordering::SeqCst) {
                        break;
                    }
                    log::debug!("mDNS receive error: {err}");
                }
            }
            if !INNER.running.load(Ordering::SeqCst) {
                break;
            }
        }
    }
}

/// Answers a query with the PlainApp service records when one is published,
/// otherwise falls back to the A-record hostname responder.
fn build_response(query: &[u8], ips: &[String]) -> Option<MdnsResponse> {
    let service = INNER.service_info.read().unwrap().clone();
    if let Some(mut service) = service {
        service.ips = ips.to_vec();
        let service_response = service_response_builder::build_response_if_match(query, &service)?;
        let matched_questions = packet_codec::read_questions(query)?;
        return Some(MdnsResponse {
            bytes: service_response.bytes,
            matched_questions,
        });
    }
    let hostname = INNER.hostname.read().unwrap().clone();
    packet_codec::build_response_if_match(query, &hostname, ips)
}

pub(crate) fn normalize_hostname(value: &str) -> String {
    let trimmed = value.trim().trim_matches('.').to_lowercase();
    if trimmed.is_empty() {
        return String::new();
    }
    if trimmed.ends_with(".local") {
        trimmed
    } else {
        format!("{trimmed}.local")
    }
}

fn create_mdns_socket() -> io::Result<socket2::Socket> {
    let socket = socket2::Socket::new(
        socket2::Domain::IPV4,
        socket2::Type::DGRAM,
        Some(socket2::Protocol::UDP),
    )?;
    socket.set_reuse_address(true)?;
    #[cfg(unix)]
    socket.set_reuse_port(true)?;
    socket.set_multicast_ttl_v4(1)?;
    socket.set_multicast_loop_v4(true)?;
    Ok(socket)
}

/// LAN interfaces with their IPv4 address, used for group join + subnet match.
pub(crate) struct MdnsIface {
    pub name: String,
    pub ip: Ipv4Addr,
    pub netmask: Ipv4Addr,
}

pub(crate) fn candidate_interfaces() -> Vec<MdnsIface> {
    let interfaces: Vec<Interface> = if_addrs::get_if_addrs().unwrap_or_default();
    let mut seen = std::collections::HashSet::new();
    interfaces
        .into_iter()
        .filter_map(|iface| match iface.addr {
            IfAddr::V4(v4) => {
                let ip = v4.ip;
                if ip.is_loopback() || ip.is_link_local() || ip.is_unspecified() {
                    return None;
                }
                if !seen.insert(ip) {
                    return None;
                }
                Some(MdnsIface {
                    name: iface.name,
                    ip,
                    netmask: v4.netmask,
                })
            }
            _ => None,
        })
        .collect()
}

fn find_response_iface(sender_ip: &str, candidates: &[MdnsIface]) -> Option<(MdnsIface, String)> {
    let sender: Ipv4Addr = sender_ip.parse().ok()?;
    for iface in candidates {
        let a = u32::from(iface.ip) & u32::from(iface.netmask);
        let b = u32::from(sender) & u32::from(iface.netmask);
        if a == b {
            return Some((MdnsIface {
                name: iface.name.clone(),
                ip: iface.ip,
                netmask: iface.netmask,
            }, iface.ip.to_string()));
        }
    }
    None
}

pub(crate) fn local_ipv4_strs() -> Vec<String> {
    candidate_interfaces()
        .into_iter()
        .map(|iface| iface.ip.to_string())
        .collect()
}

/// Picks the first candidate IP that shares a subnet with a local interface,
/// falling back to the first entry — mirrors plain-app `NetworkHelper.getBestIp`.
pub(crate) fn get_best_ip(ips: &[String]) -> String {
    match ips.first() {
        None => String::new(),
        Some(first) if ips.len() == 1 => first.clone(),
        Some(first) => {
            let locals = candidate_interfaces();
            for ip in ips {
                if find_response_iface(ip, &locals).is_some() {
                    return ip.clone();
                }
            }
            first.clone()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_hostname_appends_local() {
        assert_eq!(normalize_hostname("Ab"), "ab.local");
        assert_eq!(normalize_hostname("ab.local"), "ab.local");
        assert_eq!(normalize_hostname(" AB.LOCAL. "), "ab.local");
        assert_eq!(normalize_hostname(""), "");
    }

    #[test]
    fn candidate_interfaces_exclude_loopback() {
        for iface in candidate_interfaces() {
            assert!(!iface.ip.is_loopback());
        }
    }

    #[test]
    fn find_response_iface_matches_subnet() {
        let candidates = vec![MdnsIface {
            name: "en0".to_string(),
            ip: "192.168.1.5".parse().unwrap(),
            netmask: "255.255.255.0".parse().unwrap(),
        }];
        let (iface, ip) =
            find_response_iface("192.168.1.100", &candidates).expect("same subnet");
        assert_eq!(iface.name, "en0");
        assert_eq!(ip, "192.168.1.5");
        assert!(find_response_iface("10.0.0.1", &candidates).is_none());
    }
}
