use super::nearby_network::{self as NearbyNetwork, ReceiverHandle};
use super::nearby_pair_manager::NearbyPairManager;
use super::peer_status_manager::PeerStatusManager;
use crate::crypto::{base64_decode, base64_encode, chacha20_decrypt, chacha20_encrypt};
use crate::local::db::{ChatDb, now_iso};
use crate::local::pairing::PairingManager;
use crate::prefs::AppIdentity;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{
    Arc, Mutex, RwLock, mpsc,
    atomic::{AtomicU64, Ordering},
};
use std::time::{Duration, Instant};

const DISCOVER_PREFIX: &str = "DISCOVER:";
const DISCOVER_REPLY_PREFIX: &str = "DISCOVER_REPLY:";
const LOCAL_DEVICE_TYPE_WIRE: &str = "COMPUTER";
const SCAN_TIMEOUT_MS: u64 = 2_500;

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

#[derive(Clone)]
pub struct NearbyDiscoverManager {
    db: Arc<ChatDb>,
    identity: Arc<AppIdentity>,
    device_name: Arc<RwLock<String>>,
    pairing: PairingManager,
    #[allow(dead_code)]
    peer_status: PeerStatusManager,
    https_port: u16,
    receiver: Arc<Mutex<Option<ReceiverHandle>>>,
    listeners: Arc<Mutex<Vec<(u64, mpsc::Sender<DiscoverReplyEvent>)>>>,
    next_listener_id: Arc<AtomicU64>,
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
            https_port,
            receiver: Arc::new(Mutex::new(None)),
            listeners: Arc::new(Mutex::new(Vec::new())),
            next_listener_id: Arc::new(AtomicU64::new(1)),
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
        let _ = NearbyPairManager::handle_datagram(&self.pairing, &message, &sender_ip);
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
            return;
        };
        if !request.to_id.is_empty() {
            if self.is_directed_query_for_us(&request) {
                self.send_discover_reply(sender_ip);
            }
            return;
        }
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
            port: self.https_port,
            version: env!("CARGO_PKG_VERSION").to_string(),
            platform: std::env::consts::OS.to_string(),
            ips: NearbyNetwork::local_ipv4_strs(),
        };
        let message = format!(
            "{}{}",
            DISCOVER_REPLY_PREFIX,
            serde_json::to_string(&reply).unwrap_or_default()
        );
        NearbyNetwork::send_unicast(&message, target_ip);
    }

    fn handle_discover_reply(&self, payload: &str, sender_ip: &str) {
        let Ok(reply) = serde_json::from_str::<DiscoverReply>(payload) else {
            return;
        };
        self.update_known_peer(&reply, sender_ip);
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
                found.entry(event.reply.id.clone()).or_insert(DiscoveredDevice {
                    id: event.reply.id.clone(),
                    name: event.reply.name.clone(),
                    host: format!("{host_ip}:{}", event.reply.port),
                    ip: host_ip,
                    port: event.reply.port,
                    device_type: normalize_device_type(&event.reply.device_type),
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

fn normalize_device_type(wire: &str) -> String {
    match wire {
        "COMPUTER" => "computer".to_string(),
        "PHONE" => "phone".to_string(),
        "TABLET" => "tablet".to_string(),
        "TV" => "tv".to_string(),
        "OTHER" => "other".to_string(),
        value => value.to_string(),
    }
}

pub async fn discover_devices_impl(
    state: tauri::State<'_, NearbyDiscoverManager>,
) -> Result<DiscoverDevicesResult, String> {
    Ok(state.discover_devices().await)
}
