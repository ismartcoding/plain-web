//! DNS/mDNS wire-format codec shared by the hostname responder, the service
//! publisher and the service browser.
//!
//! Covers:
//!  - A-record query matching / response building (hostname responder)
//!  - PTR/SRV/TXT/A query building (browser)
//!  - DNS message parsing into typed records (browser)
//!
//! Translated from plain-app `MdnsPacketCodec.kt`.

use super::service_info::{MdnsParsedResponse, MdnsRecord};

pub(crate) const DNS_CLASS_IN: u16 = 0x0001;
pub(crate) const TYPE_A: u16 = 0x0001;
pub(crate) const TYPE_PTR: u16 = 0x000C;
pub(crate) const TYPE_TXT: u16 = 0x0010;
pub(crate) const TYPE_SRV: u16 = 0x0021;
pub(crate) const TYPE_ANY: u16 = 0x00FF;
pub(crate) const DNS_RESPONSE_FLAGS: u16 = 0x8400;
pub(crate) const DNS_CACHE_FLUSH_CLASS_IN: u16 = 0x8001;
pub(crate) const TTL_SECONDS: u32 = 120;

#[derive(Debug, Clone, PartialEq)]
pub(crate) struct MdnsQuestion {
    pub name: String,
    pub qtype: u16,
    pub qclass: u16,
    pub unicast_response_requested: bool,
}

#[derive(Debug, Clone)]
pub(crate) struct MdnsResponse {
    pub bytes: Vec<u8>,
    pub matched_questions: Vec<MdnsQuestion>,
}

impl MdnsResponse {
    pub fn unicast_response_requested(&self) -> bool {
        self.matched_questions
            .iter()
            .any(|q| q.unicast_response_requested)
    }
}

pub(crate) fn build_response_if_match(
    query: &[u8],
    hostname: &str,
    ips: &[String],
) -> Option<MdnsResponse> {
    if ips.is_empty() {
        return None;
    }
    let questions = read_questions(query)?;
    let matched_questions: Vec<MdnsQuestion> = questions
        .iter()
        .filter(|q| {
            q.name.eq_ignore_ascii_case(hostname)
                && q.qclass == DNS_CLASS_IN
                && (q.qtype == TYPE_A || q.qtype == TYPE_ANY)
        })
        .cloned()
        .collect();
    if matched_questions.is_empty() {
        return None;
    }

    let name_bytes = encode_name(hostname);
    let mut out = Vec::new();
    write_header(&mut out, ips.len(), 0);
    for ip in ips {
        write_record(&mut out, &name_bytes, TYPE_A, DNS_CACHE_FLUSH_CLASS_IN, TTL_SECONDS, &ip_to_bytes(ip));
    }
    Some(MdnsResponse {
        bytes: out,
        matched_questions,
    })
}

// ---- Query builders ---------------------------------------------------------

pub(crate) fn build_query(name: &str, qtype: u16, unicast_response: bool) -> Vec<u8> {
    let mut out = Vec::new();
    write_u16(&mut out, 0); // ID
    write_u16(&mut out, 0); // flags: query
    write_u16(&mut out, 1); // QDCOUNT
    write_u16(&mut out, 0); // ANCOUNT
    write_u16(&mut out, 0); // NSCOUNT
    write_u16(&mut out, 0); // ARCOUNT
    out.extend_from_slice(&encode_name(name));
    write_u16(&mut out, qtype);
    write_u16(&mut out, if unicast_response { 0x8001 } else { DNS_CLASS_IN });
    out
}

pub(crate) fn build_ptr_query(service_type: &str) -> Vec<u8> {
    build_query(service_type, TYPE_PTR, false)
}

pub(crate) fn build_srv_query(instance_name: &str, service_type: &str) -> Vec<u8> {
    build_query(&format!("{instance_name}.{service_type}"), TYPE_SRV, false)
}

pub(crate) fn build_txt_query(instance_name: &str, service_type: &str) -> Vec<u8> {
    build_query(&format!("{instance_name}.{service_type}"), TYPE_TXT, false)
}

// ---- Response parsing ---------------------------------------------------------

/// Parses a DNS/mDNS message into its answers and additional records.
/// The query section (if present) is skipped.
pub(crate) fn parse_response(data: &[u8]) -> Option<MdnsParsedResponse> {
    if data.len() < 12 {
        return None;
    }
    let flags = read_u16(data, 2);
    let qd_count = read_u16(data, 4) as usize;
    let an_count = read_u16(data, 6) as usize;
    let ns_count = read_u16(data, 8) as usize;
    let ar_count = read_u16(data, 10) as usize;

    let mut offset = 12usize;
    for _ in 0..qd_count {
        let (_, next) = read_name(data, offset, 0)?;
        offset = next + 4;
        if offset > data.len() {
            return None;
        }
    }
    let (answers, offset) = read_records(data, offset, an_count)?;
    let (authority, offset) = read_records(data, offset, ns_count)?;
    let (additional, _) = read_records(data, offset, ar_count)?;
    let _ = authority;
    Some(MdnsParsedResponse {
        flags,
        answers,
        additional,
    })
}

fn read_records(data: &[u8], start: usize, count: usize) -> Option<(Vec<MdnsRecord>, usize)> {
    let mut records = Vec::with_capacity(count);
    let mut offset = start;
    for _ in 0..count {
        let (name, next) = read_name(data, offset, 0)?;
        offset = next;
        if offset + 10 > data.len() {
            return None;
        }
        let record_type = read_u16(data, offset);
        let cls = read_u16(data, offset + 2);
        let ttl = read_u32(data, offset + 4);
        let rdlen = read_u16(data, offset + 8) as usize;
        offset += 10;
        if offset + rdlen > data.len() {
            return None;
        }
        records.push(MdnsRecord {
            name,
            record_type,
            cls,
            ttl,
            packet: data.to_vec(),
            rdata_start: offset,
            rdata_length: rdlen,
        });
        offset += rdlen;
    }
    Some((records, offset))
}

/// Parses the question section of a query message. None if not a query.
pub(crate) fn read_questions(data: &[u8]) -> Option<Vec<MdnsQuestion>> {
    if data.len() < 12 {
        return None;
    }
    // Bit 15 (QR) = 1 means this is a response, not a query. Ignore it.
    if read_u16(data, 2) & 0x8000 != 0 {
        return None;
    }
    let qd_count = read_u16(data, 4) as usize;
    if qd_count == 0 {
        return None;
    }

    let mut offset = 12usize;
    let mut questions = Vec::with_capacity(qd_count);
    for _ in 0..qd_count {
        let (qname, next) = read_name(data, offset, 0)?;
        offset = next;
        if offset + 4 > data.len() {
            return None;
        }
        let qtype = read_u16(data, offset);
        let qclass_raw = read_u16(data, offset + 2);
        questions.push(MdnsQuestion {
            name: qname,
            qtype,
            qclass: qclass_raw & 0x7FFF,
            unicast_response_requested: qclass_raw & 0x8000 != 0,
        });
        offset += 4;
    }
    Some(questions)
}

// ---- DNS wire-format helpers ---------------------------------------------------

pub(crate) fn write_header(out: &mut Vec<u8>, answers: usize, additional: usize) {
    write_u16(out, 0);
    write_u16(out, DNS_RESPONSE_FLAGS);
    write_u16(out, 0);
    write_u16(out, answers as u16);
    write_u16(out, 0);
    write_u16(out, additional as u16);
}

pub(crate) fn write_record(
    out: &mut Vec<u8>,
    name: &[u8],
    record_type: u16,
    cls: u16,
    ttl: u32,
    rdata: &[u8],
) {
    out.extend_from_slice(name);
    write_u16(out, record_type);
    write_u16(out, cls);
    write_u32(out, ttl);
    write_u16(out, rdata.len() as u16);
    out.extend_from_slice(rdata);
}

pub(crate) fn encode_name(name: &str) -> Vec<u8> {
    let mut out = Vec::new();
    for label in name.split('.').filter(|l| !l.is_empty()) {
        let bytes = label.as_bytes();
        out.push(bytes.len() as u8);
        out.extend_from_slice(bytes);
    }
    out.push(0);
    out
}

pub(crate) fn read_name(data: &[u8], start: usize, depth: u32) -> Option<(String, usize)> {
    if depth > 8 || start >= data.len() {
        return None;
    }

    let mut labels: Vec<String> = Vec::new();
    let mut offset = start;
    while offset < data.len() {
        let len = data[offset] as usize;
        if len == 0 {
            return Some((labels.join("."), offset + 1));
        }

        if (len & 0xC0) == 0xC0 {
            if offset + 1 >= data.len() {
                return None;
            }
            let ptr = ((len & 0x3F) << 8) | data[offset + 1] as usize;
            let (pointed, _) = read_name(data, ptr, depth + 1)?;
            let pointed_labels: Vec<String> = pointed
                .split('.')
                .filter(|l| !l.is_empty())
                .map(String::from)
                .collect();
            labels.extend(pointed_labels);
            return Some((labels.join("."), offset + 2));
        }

        let next = offset + 1 + len;
        if next > data.len() {
            return None;
        }
        labels.push(String::from_utf8_lossy(&data[offset + 1..offset + 1 + len]).to_string());
        offset = next;
    }
    None
}

pub(crate) fn read_u16(data: &[u8], offset: usize) -> u16 {
    ((data[offset] as u16) << 8) | data[offset + 1] as u16
}

pub(crate) fn read_u32(data: &[u8], offset: usize) -> u32 {
    ((data[offset] as u32) << 24)
        | ((data[offset + 1] as u32) << 16)
        | ((data[offset + 2] as u32) << 8)
        | (data[offset + 3] as u32)
}

pub(crate) fn write_u16(out: &mut Vec<u8>, value: u16) {
    out.push((value >> 8) as u8);
    out.push((value & 0xFF) as u8);
}

pub(crate) fn write_u32(out: &mut Vec<u8>, value: u32) {
    out.push((value >> 24) as u8);
    out.push((value >> 16) as u8);
    out.push((value >> 8) as u8);
    out.push((value & 0xFF) as u8);
}

pub(crate) fn ip_to_bytes(ip: &str) -> Vec<u8> {
    ip.split('.')
        .filter_map(|part| part.parse::<u8>().ok())
        .collect()
}
