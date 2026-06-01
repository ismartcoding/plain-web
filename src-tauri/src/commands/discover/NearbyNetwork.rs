use if_addrs::{IfAddr, Interface};
use std::io;
use std::net::{Ipv4Addr, SocketAddrV4, UdpSocket};
use std::sync::{
    Arc,
    atomic::{AtomicBool, Ordering},
};
use std::time::Duration;

pub const MULTICAST_ADDR: Ipv4Addr = Ipv4Addr::new(224, 0, 0, 100);
pub const NEARBY_PORT: u16 = 52352;
const RECEIVE_TIMEOUT_MS: u64 = 10_000;
const RESTART_DELAY_MS: u64 = 2_000;
const RECV_BUF_SIZE: usize = 4096;

#[derive(Clone, Copy, Debug, Default)]
pub struct MulticastSendSummary {
    pub sent: usize,
    pub permission_denied: bool,
}

#[allow(dead_code)]
#[derive(Clone)]
pub struct ReceiverHandle {
    running: Arc<AtomicBool>,
}

impl ReceiverHandle {
    #[allow(dead_code)]
    pub fn stop(&self) {
        self.running.store(false, Ordering::SeqCst);
    }
}

pub fn start_receiver(on_message: Arc<dyn Fn(String, String) + Send + Sync>) -> ReceiverHandle {
    let running = Arc::new(AtomicBool::new(true));
    let task_running = running.clone();
    tauri::async_runtime::spawn_blocking(move || {
        while task_running.load(Ordering::SeqCst) {
            if let Err(err) = receive_loop(on_message.clone(), task_running.clone()) {
                log::error!("discover receiver error: {err}");
            }
            if task_running.load(Ordering::SeqCst) {
                std::thread::sleep(Duration::from_millis(RESTART_DELAY_MS));
            }
        }
    });
    ReceiverHandle { running }
}

pub fn send_multicast(message: &str) -> MulticastSendSummary {
    let target = SocketAddrV4::new(MULTICAST_ADDR, NEARBY_PORT);
    let interfaces = if_addrs::get_if_addrs().unwrap_or_default();
    let mut bind_addrs = local_ipv4_addrs(&interfaces);
    if bind_addrs.is_empty() {
        bind_addrs.push(Ipv4Addr::UNSPECIFIED);
    }

    let mut summary = MulticastSendSummary::default();
    for ip in bind_addrs {
        let socket = match UdpSocket::bind(SocketAddrV4::new(ip, 0)) {
            Ok(socket) => socket,
            Err(err) => {
                if err.kind() == io::ErrorKind::PermissionDenied {
                    summary.permission_denied = true;
                }
                continue;
            }
        };
        let _ = socket.set_multicast_ttl_v4(1);
        let _ = socket.set_multicast_loop_v4(true);
        match socket.send_to(message.as_bytes(), target) {
            Ok(_) => summary.sent += 1,
            Err(err) => {
                if err.kind() == io::ErrorKind::PermissionDenied {
                    summary.permission_denied = true;
                }
            }
        }
    }
    summary
}

pub fn send_unicast(message: &str, target_ip: &str) {
    if let Ok(socket) = UdpSocket::bind(SocketAddrV4::new(Ipv4Addr::UNSPECIFIED, 0)) {
        let _ = socket.send_to(message.as_bytes(), format!("{target_ip}:{NEARBY_PORT}"));
    }
}

pub fn local_ipv4_strs() -> Vec<String> {
    let interfaces = if_addrs::get_if_addrs().unwrap_or_default();
    local_ipv4_addrs(&interfaces)
        .into_iter()
        .map(|ip| ip.to_string())
        .collect()
}

fn receive_loop(
    on_message: Arc<dyn Fn(String, String) + Send + Sync>,
    running: Arc<AtomicBool>,
) -> io::Result<()> {
    let socket = UdpSocket::bind(SocketAddrV4::new(Ipv4Addr::UNSPECIFIED, NEARBY_PORT))?;
    socket.set_read_timeout(Some(Duration::from_millis(RECEIVE_TIMEOUT_MS)))?;
    let _ = socket.join_multicast_v4(&MULTICAST_ADDR, &Ipv4Addr::UNSPECIFIED);

    let mut buf = [0u8; RECV_BUF_SIZE];
    while running.load(Ordering::SeqCst) {
        match socket.recv_from(&mut buf) {
            Ok((n, src)) => {
                let std::net::IpAddr::V4(sender_ip) = src.ip() else {
                    continue;
                };
                let Ok(message) = std::str::from_utf8(&buf[..n]) else {
                    continue;
                };
                on_message(message.to_string(), sender_ip.to_string());
            }
            Err(err)
                if err.kind() == io::ErrorKind::WouldBlock
                    || err.kind() == io::ErrorKind::TimedOut => {}
            Err(err) => return Err(err),
        }
    }

    let _ = socket.leave_multicast_v4(&MULTICAST_ADDR, &Ipv4Addr::UNSPECIFIED);
    Ok(())
}

fn local_ipv4_addrs(interfaces: &[Interface]) -> Vec<Ipv4Addr> {
    let mut addrs: Vec<Ipv4Addr> = interfaces
        .iter()
        .filter_map(|iface| match &iface.addr {
            IfAddr::V4(v4) => Some(v4.ip),
            _ => None,
        })
        .filter(|ip| !ip.is_loopback() && !ip.is_link_local() && !ip.is_unspecified())
        .collect();

    let mut seen = std::collections::HashSet::new();
    addrs.retain(|ip| seen.insert(*ip));
    addrs.sort_by_key(|ip| {
        let octets = ip.octets();
        let private_lan = ip.is_private() && !is_cgnat(&octets);
        if private_lan { 0 } else { 1 }
    });
    addrs
}

fn is_cgnat(octets: &[u8; 4]) -> bool {
    octets[0] == 100 && (octets[1] & 0xC0) == 64
}
