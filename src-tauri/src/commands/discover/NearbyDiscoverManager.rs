use super::nearby_network::{self as NearbyNetwork, ReceiverHandle};
use super::nearby_pair_manager::NearbyPairManager;
use super::peer_status_manager::PeerStatusManager;
use crate::crypto::{base64_decode, base64_encode, chacha20_decrypt, chacha20_encrypt};
use crate::local::db::{ChatDb, now_iso};
use crate::local::enums::DeviceType;
use crate::local::graphql::{
    WS_NEARBY_DEVICE_FOUND, WS_NEARBY_DISCOVERY_STARTED, WS_NEARBY_DISCOVERY_STOPPED, WsEvent,
};
use crate::local::pairing::PairingManager;
use crate::prefs::AppIdentity;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::str::FromStr;
use std::sync::{
    Arc, Mutex, RwLock, mpsc,
    atomic::{AtomicBool, AtomicU64, Ordering},
};
use std::time::{Duration, Instant};
use tokio::sync::broadcast;

const DISCOVER_PREFIX: &str = "DISCOVER:";
const DISCOVER_REPLY_PREFIX: &str = "DISCOVER_REPLY:";
const LOCAL_DEVICE_TYPE_WIRE: &str = "COMPUTER";
const SCAN_TIMEOUT_MS: u64 = 2_500;
/// Period between successive discover broadcasts while continuous
/// discovery is active. Matches plain-app's `NearbyDiscoveryManager`.
const CONTINUOUS_DISCOVER_INTERVAL_MS: u64 = 1_500;

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveredDevice {
    pub id: String,
    pub name: String,
    pub ips: Vec<String>,
    pub port: u16,
    pub device_type: String,
    #[serde(default)]
    pub version: String,
    #[serde(default)]
    pub platform: String,
    #[serde(default)]
    pub last_seen: String,
    #[serde(default)]
    pub status: String,
    #[serde(default)]
    pub discovery_methods: Vec<String>,
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

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
struct DiscoverRequest {
    #[serde(default)]
    from_id: String,
    #[serde(default)]
    to_id: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
struct DiscoverReply {
    id: String,
    name: String,
    device_type: String,
    port: u16,
    #[serde(default)]
    version: String,
    #[serde(default)]
    platform: String,
    #[serde(default)]
    ips: Vec<String>,
}

#[derive(Clone, Debug)]
struct DiscoverReplyEvent {
    reply: DiscoverReply,
    sender_ip: String,
}

type DiscoverListener = (u64, mpsc::Sender<DiscoverReplyEvent>);

#[derive(Clone)]
pub struct NearbyDiscoverManager {
    db: Arc<ChatDb>,
    identity: Arc<AppIdentity>,
    device_name: Arc<RwLock<String>>,
    pairing: PairingManager,
    #[allow(dead_code)]
    peer_status: PeerStatusManager,
    https_port: Arc<RwLock<u16>>,
    receiver: Arc<Mutex<Option<ReceiverHandle>>>,
    listeners: Arc<Mutex<Vec<DiscoverListener>>>,
    next_listener_id: Arc<AtomicU64>,
    event_tx: Arc<RwLock<Option<broadcast::Sender<WsEvent>>>>,
    continuous_running: Arc<AtomicBool>,
    continuous_task: Arc<Mutex<Option<tauri::async_runtime::JoinHandle<()>>>>,
    seen_in_session: Arc<Mutex<HashMap<String, DiscoveredDevice>>>,
}

impl NearbyDiscoverManager {
    pub fn new(
        db: Arc<ChatDb>,
        identity: Arc<AppIdentity>,
        device_name: Arc<RwLock<String>>,
        pairing: PairingManager,
        peer_status: PeerStatusManager,
        https_port: u16,
    ) -> Self {
        Self {
            db,
            identity,
            device_name,
            pairing,
            peer_status,
            https_port: Arc::new(RwLock::new(https_port)),
            receiver: Arc::new(Mutex::new(None)),
            listeners: Arc::new(Mutex::new(Vec::new())),
            next_listener_id: Arc::new(AtomicU64::new(1)),
            event_tx: Arc::new(RwLock::new(None)),
            continuous_running: Arc::new(AtomicBool::new(false)),
            continuous_task: Arc::new(Mutex::new(None)),
            seen_in_session: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn set_event_tx(&self, event_tx: broadcast::Sender<WsEvent>) {
        *self.event_tx.write().unwrap() = Some(event_tx);
    }

    /// Called by `LocalServerState::start` once the HTTPS port is
    /// bound. The discover reply advertises this port so other peers
    /// can dial back for status / chat.
    pub fn set_https_port(&self, port: u16) {
        *self.https_port.write().unwrap() = port;
    }

    /// Start a background scan loop that broadcasts every
    /// `CONTINUOUS_DISCOVER_INTERVAL_MS` and pushes each reply over
    /// the local server WS as `WS_NEARBY_DEVICE_FOUND`. Mirrors
    /// plain-app's `startDiscovery` mutation.
    pub fn start_discovery(&self) -> bool {
        if self.continuous_running.swap(true, Ordering::SeqCst) {
            return false;
        }
        self.start();
        {
            let mut seen = self.seen_in_session.lock().unwrap();
            seen.clear();
        }
        self.emit_event(WS_NEARBY_DISCOVERY_STARTED, "{}");

        let this = self.clone();
        let handle = tauri::async_runtime::spawn(async move {
            while this.continuous_running.load(Ordering::SeqCst) {
                let summary = this.broadcast_discover(DiscoverRequest::default());
                if summary.sent == 0 {
                    this.emit_event(
                        WS_NEARBY_DISCOVERY_STOPPED,
                        &serde_json::json!({ "reason": "no_receivers" }).to_string(),
                    );
                    this.continuous_running.store(false, Ordering::SeqCst);
                    break;
                }
                tokio::time::sleep(Duration::from_millis(CONTINUOUS_DISCOVER_INTERVAL_MS)).await;
            }
        });
        *self.continuous_task.lock().unwrap() = Some(handle);
        true
    }

    /// Cancel the background scan loop started by
    /// `start_discovery`. Mirrors plain-app's `stopDiscovery`.
    pub fn stop_discovery(&self) -> bool {
        if !self.continuous_running.swap(false, Ordering::SeqCst) {
            return false;
        }
        if let Some(handle) = self.continuous_task.lock().unwrap().take() {
            handle.abort();
        }
        {
            let mut seen = self.seen_in_session.lock().unwrap();
            seen.clear();
        }
        self.emit_event(WS_NEARBY_DISCOVERY_STOPPED, "{}");
        true
    }

    /// Mirrors plain-app's `isDiscovering` query.
    pub fn is_discovering(&self) -> bool {
        self.continuous_running.load(Ordering::SeqCst)
    }

    fn emit_event(&self, event_type: i32, payload: &str) {
        if let Some(tx) = self.event_tx.read().unwrap().clone() {
            let _ = tx.send(WsEvent {
                event_type,
                payload: payload.to_string(),
            });
        }
    }

    pub fn start(&self) {
        let mut receiver = self.receiver.lock().unwrap();
        if receiver.is_some() {
            return;
        }
        let this = self.clone();
        let callback = Arc::new(move |message: String, sender_ip: String| {
            this.on_datagram(message, sender_ip);
        });
        *receiver = Some(NearbyNetwork::start_receiver(callback));
    }

    #[allow(dead_code)]
    pub fn stop(&self) {
        if let Some(receiver) = self.receiver.lock().unwrap().take() {
            receiver.stop();
        }
    }

    pub fn discover_specific_device(&self, to_id: &str, key: &[u8]) {
        let Some(encrypted_to_id) = chacha20_encrypt(key, to_id.as_bytes()) else {
            return;
        };
        self.broadcast_discover(DiscoverRequest {
            from_id: self.identity.client_id.clone(),
            to_id: base64_encode(&encrypted_to_id),
        });
    }

    pub async fn discover_devices(&self) -> DiscoverDevicesResult {
        self.start();
        let (listener_id, rx) = self.register_listener();
        let summary = self.broadcast_discover(DiscoverRequest::default());
        if summary.sent == 0 {
            self.unregister_listener(listener_id);
            return DiscoverDevicesResult {
                devices: vec![],
                status: if summary.permission_denied {
                    DiscoverScanStatus::PermissionDenied
                } else {
                    DiscoverScanStatus::NetworkError
                },
            };
        }

        let result = tauri::async_runtime::spawn_blocking(move || collect_discover_replies(rx))
            .await
            .unwrap_or_else(|_| DiscoverDevicesResult {
                devices: vec![],
                status: DiscoverScanStatus::NetworkError,
            });
        self.unregister_listener(listener_id);
        result
    }

    fn register_listener(&self) -> (u64, mpsc::Receiver<DiscoverReplyEvent>) {
        let listener_id = self.next_listener_id.fetch_add(1, Ordering::SeqCst);
        let (tx, rx) = mpsc::channel();
        self.listeners.lock().unwrap().push((listener_id, tx));
        (listener_id, rx)
    }

    fn unregister_listener(&self, listener_id: u64) {
        self.listeners
            .lock()
            .unwrap()
            .retain(|(id, _)| *id != listener_id);
    }

    fn on_datagram(&self, message: String, sender_ip: String) {
        log::debug!(
            "nearby_discover: on_datagram sender={sender_ip} msg_prefix={:?}",
            message.split(':').next().unwrap_or("")
        );
        if NearbyNetwork::local_ipv4_strs().iter().any(|ip| ip == &sender_ip) {
            return;
        }

        if let Some(payload) = message.strip_prefix(DISCOVER_PREFIX) {
            self.handle_discover_request(payload, &sender_ip);
            return;
        }
        if let Some(payload) = message.strip_prefix(DISCOVER_REPLY_PREFIX) {
            self.handle_discover_reply(payload, &sender_ip);
            return;
        }
        let handled = NearbyPairManager::handle_datagram(&self.pairing, &message, &sender_ip);
        log::debug!(
            "nearby_discover: pair datagram handled={handled} sender={sender_ip}"
        );
    }

    fn broadcast_discover(&self, request: DiscoverRequest) -> NearbyNetwork::MulticastSendSummary {
        let message = format!(
            "{}{}",
            DISCOVER_PREFIX,
            serde_json::to_string(&request).unwrap_or_default()
        );
        NearbyNetwork::send_multicast(&message)
    }

    fn handle_discover_request(&self, payload: &str, sender_ip: &str) {
        let Ok(request) = serde_json::from_str::<DiscoverRequest>(payload) else {
            log::debug!("nearby_discover: bad DISCOVER payload from {sender_ip}");
            return;
        };
        if !request.to_id.is_empty() {
            if self.is_directed_query_for_us(&request) {
                log::debug!("nearby_discover: directed DISCOVER from {sender_ip}, replying");
                self.send_discover_reply(sender_ip);
            }
            return;
        }
        log::debug!("nearby_discover: broadcast DISCOVER from {sender_ip}, replying");
        self.send_discover_reply(sender_ip);
    }

    fn is_directed_query_for_us(&self, request: &DiscoverRequest) -> bool {
        if request.from_id.is_empty() || request.to_id.is_empty() {
            return false;
        }
        let Some(peer) = self.db.get_peer_by_id(&request.from_id) else {
            return false;
        };
        if !peer.is_paired() {
            return false;
        }
        let key = base64_decode(&peer.key);
        if key.len() != 32 {
            return false;
        }
        let ciphertext = base64_decode(&request.to_id);
        let Some(plaintext) = chacha20_decrypt(&key, &ciphertext) else {
            return false;
        };
        std::str::from_utf8(&plaintext)
            .map(|value| value == self.identity.client_id)
            .unwrap_or(false)
    }

    fn send_discover_reply(&self, target_ip: &str) {
        let reply = DiscoverReply {
            id: self.identity.client_id.clone(),
            name: self.device_name.read().unwrap().clone(),
            device_type: LOCAL_DEVICE_TYPE_WIRE.to_string(),
            port: *self.https_port.read().unwrap(),
            version: env!("CARGO_PKG_VERSION").to_string(),
            platform: std::env::consts::OS.to_string(),
            ips: NearbyNetwork::local_ipv4_strs(),
        };
        let message = format!(
            "{}{}",
            DISCOVER_REPLY_PREFIX,
            serde_json::to_string(&reply).unwrap_or_default()
        );
        log::debug!(
            "nearby_discover: sending DISCOVER_REPLY to {target_ip} id={} port={} ips={:?}",
            reply.id, reply.port, reply.ips
        );
        NearbyNetwork::send_unicast(&message, target_ip);
    }

    fn handle_discover_reply(&self, payload: &str, sender_ip: &str) {
        let Ok(reply) = serde_json::from_str::<DiscoverReply>(payload) else {
            log::debug!("nearby_discover: bad DISCOVER_REPLY payload from {sender_ip}");
            return;
        };
        log::debug!(
            "nearby_discover: received DISCOVER_REPLY from {sender_ip} id={} name={} port={} continuous={}",
            reply.id, reply.name, reply.port, self.continuous_running.load(Ordering::SeqCst)
        );
        self.update_known_peer(&reply, sender_ip);

        if self.continuous_running.load(Ordering::SeqCst) {
            let host_ip = if !sender_ip.is_empty() {
                sender_ip.to_string()
            } else {
                reply.ips.first().cloned().unwrap_or_default()
            };
            if !host_ip.is_empty() {
                let mut ips = reply.ips.clone();
                if !ips.contains(&host_ip) {
                    ips.insert(0, host_ip);
                }
                let device = DiscoveredDevice {
                    id: reply.id.clone(),
                    name: reply.name.clone(),
                    ips,
                    port: reply.port,
                    device_type: normalize_device_type(&reply.device_type).to_string(),
                    version: reply.version.clone(),
                    platform: reply.platform.clone(),
                    last_seen: crate::local::db::now_iso(),
                    status: self.get_device_status(&reply.id),
                    discovery_methods: vec!["LAN".to_string()],
                };
                {
                    let mut seen = self.seen_in_session.lock().unwrap();
                    seen.entry(device.id.clone()).or_insert_with(|| device.clone());
                }
                self.emit_event(
                    WS_NEARBY_DEVICE_FOUND,
                    &serde_json::to_string(&device).unwrap_or_default(),
                );
            }
        }

        let event = DiscoverReplyEvent {
            reply,
            sender_ip: sender_ip.to_string(),
        };
        let mut listeners = self.listeners.lock().unwrap();
        listeners.retain(|(_, tx)| tx.send(event.clone()).is_ok());
    }

    fn update_known_peer(&self, reply: &DiscoverReply, sender_ip: &str) {
        let Some(mut peer) = self.db.get_peer_by_id(&reply.id) else {
            return;
        };
        peer.name = reply.name.clone();
        peer.ip = prefer_sender_ip(&reply.ips, sender_ip);
        peer.port = reply.port;
        peer.device_type = normalize_device_type(&reply.device_type);
        peer.updated_at = now_iso();
        self.db.upsert_peer(&peer);
    }

    /// Mirrors plain-app's `NearbyViewModel.getStatus(deviceId, paired)`:
    /// PAIRING if a pairing session is in flight, else PAIRED if the peer
    /// exists in the DB with Paired status, else UNPAIRED.
    fn get_device_status(&self, device_id: &str) -> String {
        if self.pairing.is_pairing(device_id) {
            return "PAIRING".to_string();
        }
        match self.db.get_peer_by_id(device_id) {
            Some(peer) if peer.is_paired() => "PAIRED".to_string(),
            _ => "UNPAIRED".to_string(),
        }
    }
}

fn collect_discover_replies(rx: mpsc::Receiver<DiscoverReplyEvent>) -> DiscoverDevicesResult {
    let deadline = Instant::now() + Duration::from_millis(SCAN_TIMEOUT_MS);
    let mut found: HashMap<String, DiscoveredDevice> = HashMap::new();
    while Instant::now() < deadline {
        let wait = deadline
            .saturating_duration_since(Instant::now())
            .min(Duration::from_millis(250));
        match rx.recv_timeout(wait) {
            Ok(event) => {
                let host_ip = if !event.sender_ip.is_empty() {
                    event.sender_ip.clone()
                } else {
                    event.reply.ips.first().cloned().unwrap_or_default()
                };
                if host_ip.is_empty() {
                    continue;
                }
                let mut ips = event.reply.ips.clone();
                if !ips.contains(&host_ip) {
                    ips.insert(0, host_ip);
                }
                found.entry(event.reply.id.clone()).or_insert(DiscoveredDevice {
                    id: event.reply.id.clone(),
                    name: event.reply.name.clone(),
                    ips,
                    port: event.reply.port,
                    device_type: normalize_device_type(&event.reply.device_type).to_string(),
                    version: event.reply.version.clone(),
                    platform: event.reply.platform.clone(),
                    last_seen: crate::local::db::now_iso(),
                    status: "UNPAIRED".to_string(),
                    discovery_methods: vec!["LAN".to_string()],
                });
            }
            Err(mpsc::RecvTimeoutError::Timeout) => continue,
            Err(mpsc::RecvTimeoutError::Disconnected) => break,
        }
    }
    DiscoverDevicesResult {
        devices: found.into_values().collect(),
        status: DiscoverScanStatus::Ok,
    }
}

fn prefer_sender_ip(ips: &[String], sender_ip: &str) -> String {
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

fn normalize_device_type(wire: &str) -> DeviceType {
    DeviceType::from_str(wire).unwrap_or(DeviceType::Unknown)
}

pub async fn discover_devices_impl(
    state: tauri::State<'_, NearbyDiscoverManager>,
) -> Result<DiscoverDevicesResult, String> {
    Ok(state.discover_devices().await)
}
