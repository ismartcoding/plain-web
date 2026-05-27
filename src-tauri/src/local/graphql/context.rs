//! Shared types, WebSocket event infrastructure, and resolver context.

use crate::crypto::{base64_decode, xchacha_encrypt};
use crate::local::db::ChatDb;
use crate::prefs::AppIdentity;
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use tokio::sync::broadcast;

pub const WS_MESSAGE_CREATED: i32 = 1;
pub const WS_MESSAGE_DELETED: i32 = 2;
pub const WS_MESSAGE_UPDATED: i32 = 3;
pub const WS_CHANNELS_UPDATED: i32 = 18;

#[derive(Clone, Debug)]
pub struct WsEvent {
    pub event_type: i32,
    pub payload: String,
}

pub type PeerKeyCache = Arc<RwLock<HashMap<String, Vec<u8>>>>;

pub fn new_peer_key_cache() -> PeerKeyCache {
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
    pub peer_key_cache: PeerKeyCache,
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
