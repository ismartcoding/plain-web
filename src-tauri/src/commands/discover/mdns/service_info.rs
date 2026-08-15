//! mDNS service model + parsed record accessors.
//! Translated from plain-app `MdnsServiceInfo.kt`.

use super::packet_codec::{self, TYPE_A, TYPE_PTR, TYPE_SRV, TYPE_TXT};

/// mDNS service type advertised by PlainApp devices.
pub(crate) const PLAINAPP_SERVICE_TYPE: &str = "_plainapp._tcp.local";

/// A service instance published by a PlainApp device over mDNS.
#[derive(Debug, Clone)]
pub(crate) struct MdnsServiceInfo {
    pub instance_name: String,   // e.g. "Pixel 7 Pro"
    pub service_type: String,   // e.g. "_plainapp._tcp.local"
    pub target_hostname: String, // e.g. "plainapp-abc123.local"
    pub port: u16,
    pub txt_records: Vec<String>, // e.g. ["id=abc123", "dv=PHONE"]
    pub ips: Vec<String>,
}

impl MdnsServiceInfo {
    pub fn instance_fqdn(&self) -> String {
        format!("{}.{}", self.instance_name, self.service_type)
    }
}

/// Parsed SRV record payload.
#[derive(Debug, Clone)]
pub(crate) struct MdnsSrvRecord {
    #[allow(dead_code)]
    pub priority: u16,
    #[allow(dead_code)]
    pub weight: u16,
    pub port: u16,
    pub target: String,
}

/// One resource record parsed from a DNS/mDNS message.
#[derive(Debug, Clone)]
pub(crate) struct MdnsRecord {
    pub name: String,
    pub record_type: u16,
    #[allow(dead_code)]
    pub cls: u16,
    #[allow(dead_code)]
    pub ttl: u32,
    pub packet: Vec<u8>,
    pub rdata_start: usize,
    pub rdata_length: usize,
}

impl MdnsRecord {
    #[allow(dead_code)]
    pub fn cache_flush(&self) -> bool {
        self.cls & 0x8000 != 0
    }

    #[allow(dead_code)]
    pub fn dns_class(&self) -> u16 {
        self.cls & 0x7FFF
    }

    /// PTR RDATA — the target instance FQDN.
    pub fn ptr_target(&self) -> Option<String> {
        if self.record_type == TYPE_PTR {
            packet_codec::read_name(&self.packet, self.rdata_start, 0).map(|(n, _)| n)
        } else {
            None
        }
    }

    /// SRV RDATA — priority/weight/port/target.
    pub fn srv(&self) -> Option<MdnsSrvRecord> {
        if self.record_type == TYPE_SRV && self.rdata_length >= 6 {
            Some(MdnsSrvRecord {
                priority: packet_codec::read_u16(&self.packet, self.rdata_start),
                weight: packet_codec::read_u16(&self.packet, self.rdata_start + 2),
                port: packet_codec::read_u16(&self.packet, self.rdata_start + 4),
                target: packet_codec::read_name(&self.packet, self.rdata_start + 6, 0)
                    .map(|(n, _)| n)
                    .unwrap_or_default(),
            })
        } else {
            None
        }
    }

    /// TXT RDATA — list of "key=value" strings.
    pub fn txt_strings(&self) -> Option<Vec<String>> {
        if self.record_type == TYPE_TXT {
            Some(self.parse_txt_strings())
        } else {
            None
        }
    }

    /// A RDATA — IPv4 dotted-quad string.
    pub fn ip(&self) -> Option<String> {
        if self.record_type == TYPE_A && self.rdata_length == 4 {
            let p = &self.packet;
            let s = self.rdata_start;
            Some(format!(
                "{}.{}.{}.{}",
                p[s], p[s + 1], p[s + 2], p[s + 3]
            ))
        } else {
            None
        }
    }

    fn parse_txt_strings(&self) -> Vec<String> {
        let mut strings = Vec::new();
        let mut offset = self.rdata_start;
        let end = self.rdata_start + self.rdata_length;
        while offset < end {
            let len = self.packet[offset] as usize;
            offset += 1;
            if offset + len > end {
                break;
            }
            strings.push(
                String::from_utf8_lossy(&self.packet[offset..offset + len]).to_string(),
            );
            offset += len;
        }
        strings
    }
}

/// Parsed DNS/mDNS message: header flags plus answer/additional records.
#[derive(Debug, Clone)]
pub(crate) struct MdnsParsedResponse {
    pub flags: u16,
    pub answers: Vec<MdnsRecord>,
    pub additional: Vec<MdnsRecord>,
}

impl MdnsParsedResponse {
    pub fn is_response(&self) -> bool {
        self.flags & 0x8000 != 0
    }

    pub fn all_records(&self) -> Vec<&MdnsRecord> {
        self.answers.iter().chain(self.additional.iter()).collect()
    }
}

/// Builds the advertised mDNS service for this device. TXT keys mirror
/// plain-app's `DDiscoverReply` fields (design doc §4.1). The desktop build
/// has no Wi-Fi Aware, so `aw`/`ar` are always `0`.
pub(crate) fn build_service_info(
    instance_name: &str,
    hostname: &str,
    port: u16,
    id: &str,
    device_type: &str,
    version: &str,
    platform: &str,
    ips: Vec<String>,
) -> MdnsServiceInfo {
    MdnsServiceInfo {
        instance_name: instance_name.to_string(),
        service_type: PLAINAPP_SERVICE_TYPE.to_string(),
        target_hostname: hostname.to_string(),
        port,
        txt_records: vec![
            format!("id={id}"),
            format!("dv={device_type}"),
            format!("ver={version}"),
            format!("pf={platform}"),
            "aw=0".to_string(),
            "ar=0".to_string(),
        ],
        ips,
    }
}
