use std::net::UdpSocket;
use std::time::{SystemTime, UNIX_EPOCH};

pub(super) const NEARBY_PORT: u16 = 52352;
const MAX_TIMESTAMP_DIFF_MS: i64 = 5 * 60 * 1000;
const LOCAL_DEVICE_TYPE_VALUE: &str = "computer";

pub(super) fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

pub(super) fn timestamp_ok(ts: i64) -> bool {
    (now_ms() - ts).abs() <= MAX_TIMESTAMP_DIFF_MS
}

pub(super) fn device_type_signature_value(wire: &str) -> String {
    match wire {
        "COMPUTER" => LOCAL_DEVICE_TYPE_VALUE.to_string(),
        "PHONE" => "phone".to_string(),
        "TABLET" => "tablet".to_string(),
        "TV" => "tv".to_string(),
        "OTHER" => "other".to_string(),
        v => v.to_string(),
    }
}

pub(super) fn prefer_sender_ip(ips: &[String], sender_ip: &str) -> String {
    let mut all = Vec::with_capacity(ips.len() + 1);
    if !sender_ip.is_empty() {
        all.push(sender_ip.to_string());
    }
    for ip in ips {
        if !ip.is_empty() && ip != sender_ip && !all.contains(ip) {
            all.push(ip.clone());
        }
    }
    all.join(",")
}

#[allow(dead_code)]
pub(super) fn send_udp(msg: &str, ip: &str, port: u16) {
    if let Ok(socket) = UdpSocket::bind("0.0.0.0:0") {
        let addr = format!("{ip}:{port}");
        let _ = socket.send_to(msg.as_bytes(), &addr);
    }
}

#[allow(dead_code)]
pub(super) fn local_ipv4_strs() -> Vec<String> {
    if_addrs::get_if_addrs()
        .unwrap_or_default()
        .into_iter()
        .filter_map(|iface| match iface.addr {
            if_addrs::IfAddr::V4(v4) => {
                let ip = v4.ip;
                if !ip.is_loopback() && !ip.is_link_local() && ip.is_private() {
                    Some(ip.to_string())
                } else {
                    None
                }
            }
            _ => None,
        })
        .collect()
}
