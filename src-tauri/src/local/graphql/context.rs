//! Shared types, WebSocket event infrastructure, and resolver context.

use crate::crypto::{base64_decode, xchacha_encrypt};
use crate::commands::discover::{NearbyDiscoverManager, PeerStatusManager};
use crate::local::db::ChatDb;
use crate::prefs::AppIdentity;
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use tokio::sync::broadcast;

pub const WS_MESSAGE_CREATED: i32 = 1;
pub const WS_MESSAGE_DELETED: i32 = 2;
pub const WS_MESSAGE_UPDATED: i32 = 3;
pub const WS_BOOKMARK_UPDATED: i32 = 15;
pub const WS_CHANNELS_UPDATED: i32 = 18;
pub const WS_PEER_STATUS_UPDATED: i32 = 20;
pub const WS_CHANNEL_INVITE_RECEIVED: i32 = 22;
/// Fired by the server when a text chat item is created; the web
/// client listens for this to trigger its own link preview fetcher.
pub const WS_FETCH_LINK_PREVIEWS: i32 = 23;
/// Emitted for each LAN device that replied to a discover broadcast.
/// Payload is a single `DiscoveredDevice` JSON object.
pub const WS_NEARBY_DEVICE_FOUND: i32 = 24;
/// Mirrors plain-app's `StartNearbyDiscoveryEvent` — fired when the
/// `startDiscovering` mutation kicks off the background scan loop.
pub const WS_NEARBY_DISCOVERY_STARTED: i32 = 25;
/// Mirrors plain-app's `StopNearbyDiscoveryEvent` — fired when the
/// `stopDiscovering` mutation tears the background scan loop down.
pub const WS_NEARBY_DISCOVERY_STOPPED: i32 = 26;

#[derive(Clone, Debug)]
pub struct WsEvent {
    pub event_type: i32,
    pub payload: String,
}

pub type PeerKeyCache = Arc<RwLock<HashMap<String, Vec<u8>>>>;
pub type ChannelKeyCache = Arc<RwLock<HashMap<String, Vec<u8>>>>;

pub fn new_peer_key_cache() -> PeerKeyCache {
    Arc::new(RwLock::new(HashMap::new()))
}

pub fn new_channel_key_cache() -> ChannelKeyCache {
    Arc::new(RwLock::new(HashMap::new()))
}

/// Rebuild peer key cache from the DB. Call after any peers table mutation.
pub fn refresh_peer_key_cache(db: &ChatDb, cache: &PeerKeyCache) {
    let peers = db.get_peers();
    let mut map = cache.write().unwrap();
    map.clear();
    for p in peers {
        if !p.key.is_empty() && p.is_paired() {
            let raw = base64_decode(&p.key);
            if raw.len() == 32 {
                map.insert(p.id, raw);
            }
        }
    }
}

/// Rebuild both peer and channel key caches from the DB.
/// Mirrors `ChatCacheManager.loadKeyCacheAsync()` in plain-app.
pub fn load_key_cache(
    db: &ChatDb,
    peer_cache: &PeerKeyCache,
    channel_cache: &ChannelKeyCache,
) {
    refresh_peer_key_cache(db, peer_cache);

    let mut cm = channel_cache.write().unwrap();
    cm.clear();
    for ch in db.get_channels_with_key() {
        let raw = base64_decode(&ch.key);
        if raw.len() == 32 {
            cm.insert(ch.id, raw);
        }
    }
}

/// Encode a WsEvent for wire: [4-byte i32 BE event_type][xchacha encrypted payload].
pub fn encode_ws_event(ev: &WsEvent, token: &str) -> Option<Vec<u8>> {
    let encrypted = xchacha_encrypt(token, ev.payload.as_bytes())?;
    let mut msg = Vec::with_capacity(4 + encrypted.len());
    msg.extend_from_slice(&ev.event_type.to_be_bytes());
    msg.extend_from_slice(&encrypted);
    Some(msg)
}

/// All server-level dependencies bundled for injection into async-graphql resolvers.
/// Passed per-request via `Request::data(Arc<AppCtx>)`.
pub struct AppCtx {
    pub db: Arc<ChatDb>,
    pub identity: Arc<AppIdentity>,
    pub peer_status: PeerStatusManager,
    pub discover_manager: NearbyDiscoverManager,
    pub peer_key_cache: PeerKeyCache,
    pub channel_key_cache: ChannelKeyCache,
    pub event_tx: broadcast::Sender<WsEvent>,
    pub token: String,
    pub port: u16,
    pub https_port: u16,
    /// App data directory — used by debug resolvers to read prefs.json.
    pub data_dir: std::path::PathBuf,
    /// App log directory — used by debug resolvers to read/clear plain.log.
    pub log_dir: std::path::PathBuf,
    /// Mutable device display name — updated by the updateDeviceName mutation.
    pub device_name: Arc<std::sync::RwLock<String>>,
}
