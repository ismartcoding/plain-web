//! Channel chat delivery helper — mirrors plain-app's
//! `ChannelChatHelper` (see
//! `plain-app/.../channel/ChannelChatHelper.kt`).
//!
//! Channel chat is **star-topology**: every member in `joined` status
//! is reachable through one elected leader (the lexicographically
//! smallest online, non-self member id). The local node either
//! broadcasts to all members directly (when it is the leader) or
//! forwards the message to the leader (which will then broadcast).
//!
//! This keeps the fan-out bounded by `O(members)` per channel and
//! gives a clear failure surface: if no leader can be elected, the
//! message fails with `DMessageStatusData(results=null)`.

use std::collections::HashSet;

use serde_json::{json, Value};

use crate::commands::discover::PeerStatusManager;
use crate::crypto::base64_decode;
use crate::local::db::{ChatDb, DChannel, DPeer};
use crate::local::graphql::context::{ChannelKeyCache, PeerKeyCache};
use crate::local::graphql::peer::{deliver_to_peer, peer_graphql_urls};

/// One delivery attempt result, in the same shape as Kotlin's
/// `ChannelDeliveryResult` (`peerId` / `peerName` / `error`).
#[derive(Debug, Clone)]
pub struct ChannelDeliveryResult {
    pub peer_id: String,
    pub peer_name: String,
    pub error: Option<String>,
}

impl ChannelDeliveryResult {
    pub fn to_json(&self) -> Value {
        json!({
            "peerId": self.peer_id,
            "peerName": self.peer_name,
            "error": self.error.as_deref().map_or(Value::Null, |e| json!(e)),
        })
    }
}

/// Pick a leader for the channel from its joined, online members
/// excluding the local device. Returns `None` if there is no
/// candidate (e.g. the local device is alone, or all peers are
/// offline).
///
/// `DChannel::elect_leader` does the heavy lifting; this wrapper just
/// collects the online ids from the status manager.
pub fn elect_leader(
    channel: &DChannel,
    peer_status: &PeerStatusManager,
    my_id: &str,
) -> Option<String> {
    let online_ids: HashSet<String> = channel
        .joined_member_ids()
        .into_iter()
        .filter(|id| id != my_id && peer_status.is_online(id))
        .collect();
    channel.elect_leader(&online_ids, my_id)
}

/// Send a chat item to the channel.
///
/// * If the local device is the leader (or there is no leader to
///   elect — e.g. solo channel), broadcast to every joined member.
/// * Otherwise, send the item to the leader only.
/// * If no leader can be elected (no online peers), return `None`
///   so the caller can persist a `DMessageStatusData(results=null)`.
pub async fn send_async(
    channel: &DChannel,
    client_id: &str,
    chat_id: &str,
    content: &str,
    db: &ChatDb,
    peer_status: &PeerStatusManager,
    peer_key_cache: &PeerKeyCache,
    channel_key_cache: &ChannelKeyCache,
    kp_bytes: &[u8],
) -> Option<Vec<ChannelDeliveryResult>> {
    let leader = elect_leader(channel, peer_status, client_id);

    // Solo channel (no peers besides self). Kotlin treats this as an
    // implicit success with no per-peer results.
    let member_ids = channel.joined_member_ids();
    let other_ids: Vec<String> = member_ids
        .into_iter()
        .filter(|id| id != client_id)
        .collect();
    if other_ids.is_empty() {
        return Some(Vec::new());
    }

    let targets: Vec<String> = match leader.as_deref() {
        // I am the leader (or no leader could be elected — fall back
        // to broadcasting ourselves) — broadcast to every member.
        Some(lid) if lid == client_id => other_ids,
        None => other_ids,
        // Send only to the elected leader.
        Some(lid) => vec![lid.to_string()],
    };

    let mut results = Vec::with_capacity(targets.len());
    for target_id in targets {
        let Some(peer) = db.get_peer_by_id(&target_id) else {
            results.push(ChannelDeliveryResult {
                peer_id: target_id,
                peer_name: String::new(),
                error: Some("peer not found".to_string()),
            });
            continue;
        };

        // Choose the encryption key: prefer the channel key from
        // `channel_key_cache` (so the receiver, which checks `c-cid`,
        // can decrypt). Fall back to the peer's shared key if the
        // channel key is not loaded yet (legacy / partially
        // migrated peers).
        let key = channel_key_from_cache_or_peer(
            channel_key_cache,
            peer_key_cache,
            &channel.id,
            &peer.id,
        );
        let Some(key) = key else {
            results.push(ChannelDeliveryResult {
                peer_id: peer.id.clone(),
                peer_name: peer.name.clone(),
                error: Some("no shared key".to_string()),
            });
            continue;
        };

        let peer_urls = peer_graphql_urls(&peer);
        let res = deliver_to_peer(
            &peer_urls,
            &key,
            client_id,
            kp_bytes,
            content,
            Some(&channel.id),
        )
        .await;
        let chat_id_owned = chat_id.to_string();
        let _ = chat_id_owned; // (kept for symmetry with Kotlin)
        match res {
            Ok(()) => results.push(ChannelDeliveryResult {
                peer_id: peer.id.clone(),
                peer_name: peer.name.clone(),
                error: None,
            }),
            Err(e) => results.push(ChannelDeliveryResult {
                peer_id: peer.id.clone(),
                peer_name: peer.name.clone(),
                error: Some(e),
            }),
        }
    }

    Some(results)
}

fn channel_key_from_cache_or_peer(
    channel_key_cache: &ChannelKeyCache,
    peer_key_cache: &PeerKeyCache,
    channel_id: &str,
    peer_id: &str,
) -> Option<Vec<u8>> {
    {
        let cache = channel_key_cache.read().unwrap();
        if let Some(k) = cache.get(channel_id) {
            if !k.is_empty() {
                return Some(k.clone());
            }
        }
    }
    let cache = peer_key_cache.read().unwrap();
    cache.get(peer_id).cloned()
}

/// Aggregate per-peer results into the same status string Kotlin's
/// `ChannelChatHelper.sendAsync` produces:
///   * all success → `"sent"`
///   * all failure → `"failed"`
///   * mixed       → `"partial"`
///   * no leader   → caller is expected to short-circuit and persist
///     `DMessageStatusData(results=null)`.
pub fn compute_status(results: &[ChannelDeliveryResult]) -> &'static str {
    if results.is_empty() {
        return "sent";
    }
    let failed = results.iter().filter(|r| r.error.is_some()).count();
    if failed == 0 {
        "sent"
    } else if failed == results.len() {
        "failed"
    } else {
        "partial"
    }
}

/// Build the JSON-encoded `DMessageStatusData` payload that the
/// web frontend reads back. Mirrors `DMessageStatusData.results`,
/// returning an empty-string JSON when there are no per-peer results
/// (to match `if (statusData.total == 0) "" else ...` in Kotlin).
pub fn build_status_data_json(results: &[ChannelDeliveryResult]) -> String {
    if results.is_empty() {
        return String::new();
    }
    let arr: Vec<Value> = results.iter().map(|r| r.to_json()).collect();
    json!({ "results": arr }).to_string()
}

/// `DMessageStatusData(results=null)` — used when the channel has
/// no leader available to relay to. Mirrors Kotlin's
/// `DMessageStatusData(null)`.
pub fn build_no_leader_status_data() -> String {
    json!({ "results": Value::Null }).to_string()
}

#[allow(dead_code)]
pub fn decode_channel_key(b64: &str) -> Vec<u8> {
    base64_decode(b64)
}

/// Snapshot of all joined peer ids (for tests / debugging).
#[allow(dead_code)]
pub fn joined_ids(channel: &DChannel) -> Vec<String> {
    channel.joined_member_ids()
}

/// Look up a DPeer record by id from a list. Helper for the rare
/// "leader != me, only forward to leader" case.
#[allow(dead_code)]
pub fn find_peer<'a>(peers: &'a [DPeer], id: &str) -> Option<&'a DPeer> {
    peers.iter().find(|p| p.id == id)
}
