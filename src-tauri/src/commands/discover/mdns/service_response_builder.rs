//! Builds mDNS responses for the published `MdnsServiceInfo`.
//! Translated from plain-app `MdnsServiceResponseBuilder.kt`.
//!
//! A PTR query for the service type is answered with the PTR record plus A
//! records (additional), so a browser learns the instance name and its
//! address in one shot. SRV / TXT / A queries are answered with the matching
//! records.

use super::packet_codec::{
    self, DNS_CACHE_FLUSH_CLASS_IN, DNS_CLASS_IN, TTL_SECONDS, TYPE_A, TYPE_ANY, TYPE_PTR,
    TYPE_SRV, TYPE_TXT, MdnsQuestion,
};
use super::service_info::MdnsServiceInfo;

pub(crate) struct MdnsServiceResponse {
    pub bytes: Vec<u8>,
}

pub(crate) fn build_response_if_match(
    query: &[u8],
    service: &MdnsServiceInfo,
) -> Option<MdnsServiceResponse> {
    if service.ips.is_empty() {
        return None;
    }
    let questions: Vec<MdnsQuestion> = packet_codec::read_questions(query)?;
    let instance_fqdn = service.instance_fqdn();

    let mut want_ptr = false;
    let mut want_srv = false;
    let mut want_txt = false;
    let mut want_a = false;
    for q in &questions {
        if q.qclass != DNS_CLASS_IN {
            continue;
        }
        let matches_type = q.name.eq_ignore_ascii_case(&service.service_type);
        let matches_instance = q.name.eq_ignore_ascii_case(&instance_fqdn);
        let matches_hostname = q.name.eq_ignore_ascii_case(&service.target_hostname);
        if q.qtype == TYPE_PTR && matches_type {
            want_ptr = true;
        } else if q.qtype == TYPE_SRV && matches_instance {
            want_srv = true;
        } else if q.qtype == TYPE_TXT && matches_instance {
            want_txt = true;
        } else if q.qtype == TYPE_A && matches_hostname {
            want_a = true;
        } else if q.qtype == TYPE_ANY && (matches_type || matches_instance || matches_hostname) {
            // RFC 6762 §6: only answer ANY with records whose name matches
            // the question — otherwise we'd pollute other mDNS stacks'
            // caches with answers unrelated to the queried name.
            want_ptr = want_ptr || matches_type;
            want_srv = want_srv || matches_instance;
            want_txt = want_txt || matches_instance;
            want_a = want_a || matches_hostname;
        }
    }
    if !want_ptr && !want_srv && !want_txt && !want_a {
        return None;
    }

    let mut answers: Vec<u8> = Vec::new();
    let mut additional: Vec<u8> = Vec::new();
    if want_ptr {
        answers.extend_from_slice(&ptr_record(service));
    }
    if want_srv {
        answers.extend_from_slice(&srv_record(service));
    }
    if want_txt {
        answers.extend_from_slice(&txt_record(service));
    }
    if want_a {
        answers.extend_from_slice(&a_records(service));
    }
    // A records ride along as additional data for service queries.
    if (want_ptr || want_srv || want_txt) && !want_a {
        additional.extend_from_slice(&a_records(service));
    }
    if answers.is_empty() {
        return None;
    }

    // Each PTR/SRV/TXT is a single record; A records are one per IP.
    let answer_count = (want_ptr as usize)
        + (want_srv as usize)
        + (want_txt as usize)
        + if want_a { service.ips.len() } else { 0 };
    let additional_count = if (want_ptr || want_srv || want_txt) && !want_a {
        service.ips.len()
    } else {
        0
    };

    let mut out = Vec::new();
    packet_codec::write_header(&mut out, answer_count, additional_count);
    out.extend_from_slice(&answers);
    out.extend_from_slice(&additional);
    Some(MdnsServiceResponse { bytes: out })
}

fn ptr_record(service: &MdnsServiceInfo) -> Vec<u8> {
    let mut out = Vec::new();
    packet_codec::write_record(
        &mut out,
        &packet_codec::encode_name(&service.service_type),
        TYPE_PTR,
        // RFC 6762 §10.2: the cache-flush bit is only for unique records
        // (SRV/TXT/A). PTR rnames are shared by all instances of the type,
        // so flushing would evict other devices' PTR entries from peers.
        DNS_CLASS_IN,
        TTL_SECONDS,
        &packet_codec::encode_name(&service.instance_fqdn()),
    );
    out
}

fn srv_record(service: &MdnsServiceInfo) -> Vec<u8> {
    let mut rdata = Vec::new();
    packet_codec::write_u16(&mut rdata, 0); // priority
    packet_codec::write_u16(&mut rdata, 0); // weight
    packet_codec::write_u16(&mut rdata, service.port);
    rdata.extend_from_slice(&packet_codec::encode_name(&service.target_hostname));
    let mut out = Vec::new();
    packet_codec::write_record(
        &mut out,
        &packet_codec::encode_name(&service.instance_fqdn()),
        TYPE_SRV,
        DNS_CACHE_FLUSH_CLASS_IN,
        TTL_SECONDS,
        &rdata,
    );
    out
}

fn txt_record(service: &MdnsServiceInfo) -> Vec<u8> {
    let mut rdata = Vec::new();
    for value in &service.txt_records {
        let bytes = value.as_bytes();
        rdata.push(bytes.len() as u8);
        rdata.extend_from_slice(bytes);
    }
    let mut out = Vec::new();
    packet_codec::write_record(
        &mut out,
        &packet_codec::encode_name(&service.instance_fqdn()),
        TYPE_TXT,
        DNS_CACHE_FLUSH_CLASS_IN,
        TTL_SECONDS,
        &rdata,
    );
    out
}

fn a_records(service: &MdnsServiceInfo) -> Vec<u8> {
    let name_bytes = packet_codec::encode_name(&service.target_hostname);
    let mut out = Vec::new();
    for ip in &service.ips {
        packet_codec::write_record(
            &mut out,
            &name_bytes,
            TYPE_A,
            DNS_CACHE_FLUSH_CLASS_IN,
            TTL_SECONDS,
            &packet_codec::ip_to_bytes(ip),
        );
    }
    out
}
