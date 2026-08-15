//! mDNS service browser for `_plainapp._tcp.local`.
//! Translated from plain-app `MdnsServiceBrowser.kt`.
//!
//! Flow (design doc §4.2):
//!  1. periodically send a PTR query for the service type
//!  2. parse PTR responses to learn instance names
//!  3. for each new instance send SRV + TXT (+ A) queries
//!  4. combine port / metadata / IPs into a `FoundDevice`
//!
//! The browser shares the host responder's socket (one bind on 5353), so its
//! queries and the responder's answers stay on the same port.

use super::host_responder;
use super::packet_codec::{self, TYPE_A, TYPE_PTR, TYPE_SRV, TYPE_TXT};
use super::service_info::PLAINAPP_SERVICE_TYPE;
use crate::local::enums::DeviceType;
use std::collections::{HashMap, HashSet};
use std::str::FromStr;
use std::sync::{
    Arc, Mutex,
    atomic::{AtomicBool, Ordering},
};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const DISCOVER_INTERVAL_MS: u64 = 5_000;
/// Re-query an incomplete instance at most this often (multicast responses
/// get lost).
const FOLLOW_UP_RETRY_MS: u64 = 10_000;

/// A complete service instance handed to the discovery manager.
pub(crate) struct FoundDevice {
    pub id: String,
    pub name: String,
    pub ips: Vec<String>,
    pub port: u16,
    pub device_type: DeviceType,
    pub version: String,
    pub platform: String,
}

/// Immutable mDNS info for one service instance, accumulated across packets.
#[derive(Debug, Clone)]
struct Instance {
    instance_fqdn: String,
    instance_name: String,
    id: String,
    port: u16,
    device_type: DeviceType,
    version: String,
    platform: String,
    target_hostname: String,
    ips: HashSet<String>,
}

impl Instance {
    fn new(instance_fqdn: String, instance_name: String) -> Self {
        Instance {
            instance_fqdn,
            instance_name,
            id: String::new(),
            port: 0,
            device_type: DeviceType::Other,
            version: String::new(),
            platform: String::new(),
            target_hostname: String::new(),
            ips: HashSet::new(),
        }
    }

    fn complete(&self) -> bool {
        !self.id.is_empty() && self.port > 0 && !self.ips.is_empty()
    }
}

#[derive(Default)]
struct BrowserState {
    /// instanceFqdn(lower) → state
    instances: HashMap<String, Instance>,
    /// targetHostname(lower) → instanceFqdn(lower)
    hostname_to_instance: HashMap<String, String>,
    srv_txt_queried_at: HashMap<String, u64>,
    a_queried_at: HashMap<String, u64>,
}

struct Inner {
    state: Mutex<BrowserState>,
    running: AtomicBool,
    task: Mutex<Option<tauri::async_runtime::JoinHandle<()>>>,
    listener: Mutex<Option<host_responder::PacketListener>>,
    client_id: String,
    mdns_hostname: String,
    on_device: Box<dyn Fn(FoundDevice) + Send + Sync>,
}

/// mDNS service browser. Created once by `NearbyDiscoverManager` and cloned
/// cheaply (all state behind an `Arc`).
#[derive(Clone)]
pub(crate) struct MdnsServiceBrowser {
    inner: Arc<Inner>,
}

impl MdnsServiceBrowser {
    pub(crate) fn new(
        client_id: String,
        mdns_hostname: String,
        on_device: impl Fn(FoundDevice) + Send + Sync + 'static,
    ) -> Self {
        MdnsServiceBrowser {
            inner: Arc::new(Inner {
                state: Mutex::new(BrowserState::default()),
                running: AtomicBool::new(false),
                task: Mutex::new(None),
                listener: Mutex::new(None),
                client_id,
                mdns_hostname,
                on_device: Box::new(on_device),
            }),
        }
    }

    pub(crate) fn is_running(&self) -> bool {
        self.inner.running.load(Ordering::SeqCst)
    }

    pub(crate) fn start(&self) {
        if self.inner.running.swap(true, Ordering::SeqCst) {
            return;
        }
        self.clear_state();
        let inner = self.inner.clone();
        let listener: host_responder::PacketListener =
            Arc::new(move |data: &[u8], _sender: &str| handle_packet(&inner, data));
        host_responder::add_packet_listener(listener.clone());
        *self.inner.listener.lock().unwrap() = Some(listener);

        let inner = self.inner.clone();
        let handle = tauri::async_runtime::spawn(async move {
            loop {
                if !inner.running.load(Ordering::SeqCst) {
                    break;
                }
                browse_once(&inner);
                tokio::time::sleep(Duration::from_millis(DISCOVER_INTERVAL_MS)).await;
            }
        });
        *self.inner.task.lock().unwrap() = Some(handle);
        log::debug!("mDNS browser started");
    }

    pub(crate) fn stop(&self) {
        self.inner.running.store(false, Ordering::SeqCst);
        if let Some(handle) = self.inner.task.lock().unwrap().take() {
            handle.abort();
        }
        if let Some(listener) = self.inner.listener.lock().unwrap().take() {
            host_responder::remove_packet_listener(&listener);
        }
        self.clear_state();
        log::debug!("mDNS browser stopped");
    }

    /// One-shot PTR query used by directed re-discovery of a paired peer.
    pub(crate) fn send_ptr_query(&self) {
        host_responder::send_query(&packet_codec::build_ptr_query(PLAINAPP_SERVICE_TYPE));
    }

    /// Read-only snapshot of every currently-known service instance.
    #[allow(dead_code)]
    pub(crate) fn snapshot(&self) -> Vec<MdnsServiceSnapshot> {
        let state = self.inner.state.lock().unwrap();
        let mut list: Vec<MdnsServiceSnapshot> = state
            .instances
            .values()
            .map(|instance| MdnsServiceSnapshot {
                service_type: PLAINAPP_SERVICE_TYPE.to_string(),
                instance_name: instance.instance_name.clone(),
                instance_fqdn: instance.instance_fqdn.clone(),
                hostname: instance.target_hostname.clone(),
                port: instance.port,
                ips: instance.ips.iter().cloned().collect(),
                complete: instance.complete(),
            })
            .collect();
        list.sort_by(|a, b| a.instance_fqdn.cmp(&b.instance_fqdn));
        list
    }

    fn clear_state(&self) {
        *self.inner.state.lock().unwrap() = BrowserState::default();
    }
}

/// Read-only mDNS details for one discovered device (debug surface).
#[derive(Debug, Clone)]
#[allow(dead_code)]
pub(crate) struct MdnsServiceSnapshot {
    pub service_type: String,
    pub instance_name: String,
    pub instance_fqdn: String,
    pub hostname: String,
    pub port: u16,
    pub ips: Vec<String>,
    pub complete: bool,
}

fn browse_once(inner: &Inner) {
    // Self-heal after an external socket teardown (e.g. HTTP service stop):
    // the responder keeps packet listeners, so discovery resumes seamlessly.
    host_responder::ensure_started(&inner.mdns_hostname);
    host_responder::send_query(&packet_codec::build_ptr_query(PLAINAPP_SERVICE_TYPE));
    // Follow up on instances that still lack port / metadata / IPs, re-asking
    // periodically because multicast responses can be dropped.
    let now = now_ms();
    struct DueFollowUp {
        key: String,
        instance_name: String,
        target_hostname: String,
        srv_txt_due: bool,
        a_due: bool,
    }
    let due: Vec<DueFollowUp> = {
        let state = inner.state.lock().unwrap();
        state
            .instances
            .values()
            .filter(|instance| !instance.complete())
            .map(|instance| {
                let key = instance.instance_fqdn.clone();
                DueFollowUp {
                    srv_txt_due: now.saturating_sub(*state.srv_txt_queried_at.get(&key).unwrap_or(&0))
                        >= FOLLOW_UP_RETRY_MS,
                    a_due: !instance.target_hostname.is_empty()
                        && now.saturating_sub(*state.a_queried_at.get(&key).unwrap_or(&0))
                            >= FOLLOW_UP_RETRY_MS,
                    key,
                    instance_name: instance.instance_name.clone(),
                    target_hostname: instance.target_hostname.clone(),
                }
            })
            .collect()
    };
    let (srv_txt_names, a_hostnames): (Vec<String>, Vec<String>) = {
        let mut state = inner.state.lock().unwrap();
        let mut srv_txt_names = Vec::new();
        let mut a_hostnames = Vec::new();
        for d in due {
            if d.srv_txt_due {
                state.srv_txt_queried_at.insert(d.key.clone(), now);
                srv_txt_names.push(d.instance_name);
            }
            if d.a_due {
                state.a_queried_at.insert(d.key, now);
                a_hostnames.push(d.target_hostname);
            }
        }
        (srv_txt_names, a_hostnames)
    };
    for hostname in a_hostnames {
        host_responder::send_query(&packet_codec::build_query(&hostname, TYPE_A, false));
    }
    for instance_name in srv_txt_names {
        // build_srv_query/build_txt_query append the service type
        // themselves — pass the SHORT instance name, NOT the full FQDN
        // (double-suffixed query names never match the responder's
        // instanceFqdn).
        host_responder::send_query(&packet_codec::build_srv_query(
            &instance_name,
            PLAINAPP_SERVICE_TYPE,
        ));
        host_responder::send_query(&packet_codec::build_txt_query(
            &instance_name,
            PLAINAPP_SERVICE_TYPE,
        ));
    }
}

fn handle_packet(inner: &Inner, data: &[u8]) {
    let Some(parsed) = packet_codec::parse_response(data) else {
        return;
    };
    if !parsed.is_response() {
        return;
    }

    let mut touched: HashSet<String> = HashSet::new();
    {
        let mut state = inner.state.lock().unwrap();
        for record in parsed.all_records() {
            match record.record_type {
                TYPE_PTR => {
                    if let Some(target) = record.ptr_target() {
                        if let Some((key, instance)) = find_instance(&state.instances, &target) {
                            state.instances.insert(key.clone(), instance);
                            touched.insert(key);
                        }
                    }
                }
                TYPE_SRV => {
                    if let Some(srv) = record.srv() {
                        if let Some((key, instance)) = find_instance(&state.instances, &record.name)
                        {
                            let mut updated = instance.clone();
                            updated.port = srv.port;
                            updated.target_hostname = srv.target.clone();
                            if !srv.target.is_empty() {
                                state
                                    .hostname_to_instance
                                    .insert(srv.target.to_lowercase(), key.clone());
                            }
                            state.instances.insert(key.clone(), updated);
                            touched.insert(key);
                        }
                    }
                }
                TYPE_TXT => {
                    if let Some(strings) = record.txt_strings() {
                        if let Some((key, instance)) = find_instance(&state.instances, &record.name)
                        {
                            let mut updated = instance.clone();
                            for entry in &strings {
                                let Some(eq) = entry.find('=') else {
                                    continue;
                                };
                                if eq == 0 {
                                    continue;
                                }
                                let value = &entry[eq + 1..];
                                match &entry[..eq] {
                                    "id" => updated.id = value.to_string(),
                                    "dv" => {
                                        updated.device_type =
                                            DeviceType::from_str(value).unwrap_or(DeviceType::Other)
                                    }
                                    "ver" => updated.version = value.to_string(),
                                    "pf" => updated.platform = value.to_string(),
                                    _ => {}
                                }
                            }
                            state.instances.insert(key.clone(), updated);
                            touched.insert(key);
                        }
                    }
                }
                TYPE_A => {
                    if let Some(ip) = record.ip() {
                        let key = state
                            .hostname_to_instance
                            .get(&record.name.to_lowercase())
                            .cloned();
                        if let Some(key) = key {
                            if let Some(instance) = state.instances.get_mut(&key) {
                                instance.ips.insert(ip);
                                touched.insert(key);
                            }
                        }
                    }
                }
                _ => {}
            }
        }
    }

    let complete: Vec<Instance> = {
        let state = inner.state.lock().unwrap();
        touched
            .iter()
            // Skip our own looped-back announcements (multicast loop is
            // enabled on purpose so multiple same-device sockets keep
            // working) instead of emitting this device into the nearby
            // list / peer tables.
            .filter(|key| {
                state
                    .instances
                    .get(*key)
                    .map(|i| i.id != inner.client_id)
                    .unwrap_or(false)
            })
            .filter_map(|key| {
                let instance = state.instances.get(key)?;
                if instance.complete() {
                    Some(instance.clone())
                } else {
                    None
                }
            })
            .collect()
    };

    for instance in complete {
        let mut ips: Vec<String> = instance.ips.iter().cloned().collect();
        ips.sort();
        (inner.on_device)(FoundDevice {
            id: instance.id,
            name: instance.instance_name,
            ips,
            port: instance.port,
            device_type: instance.device_type,
            version: instance.version,
            platform: instance.platform,
        });
    }
}

/// Resolves `name` against `current`; None when it is not one of our service
/// instances. Returns the key plus the existing or a fresh instance.
fn find_instance(
    current: &HashMap<String, Instance>,
    name: &str,
) -> Option<(String, Instance)> {
    if !name
        .to_lowercase()
        .ends_with(&PLAINAPP_SERVICE_TYPE.to_lowercase())
    {
        return None;
    }
    let key = name.to_lowercase();
    let instance_name_len = name.len().saturating_sub(PLAINAPP_SERVICE_TYPE.len() + 1);
    let instance_name = name[..instance_name_len].to_string();
    if instance_name.is_empty() {
        return None;
    }
    Some((
        key.clone(),
        current.get(&key).cloned().unwrap_or_else(|| Instance::new(key, instance_name)),
    ))
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_instance(fqdn: &str) -> (String, Instance) {
        let key = fqdn.to_lowercase();
        let name = fqdn.strip_suffix(&format!(".{PLAINAPP_SERVICE_TYPE}")).unwrap();
        (key.clone(), Instance::new(key, name.to_string()))
    }

    #[test]
    fn find_instance_matches_service_type_only() {
        let mut map = HashMap::new();
        let (key, inst) = test_instance("Pixel 7._plainapp._tcp.local");
        map.insert(key.clone(), inst);

        let (k, i) = find_instance(&map, "pixel 7._plainapp._tcp.local").unwrap();
        assert_eq!(k, key);
        assert_eq!(i.instance_name, "Pixel 7");

        // Non-service names are ignored.
        assert!(find_instance(&map, "other._http._tcp.local").is_none());
        // The bare service type has no instance name.
        assert!(find_instance(&map, PLAINAPP_SERVICE_TYPE).is_none());
    }

    #[test]
    fn instance_complete_requires_all_parts() {
        let (key, mut inst) = test_instance("X._plainapp._tcp.local");
        assert!(!inst.complete());
        inst.id = "abc".to_string();
        assert!(!inst.complete());
        inst.port = 8443;
        assert!(!inst.complete());
        inst.ips.insert("192.168.1.2".to_string());
        assert!(inst.complete());
        assert_eq!(key, "x._plainapp._tcp.local");
    }
}
