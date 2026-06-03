//! Sender-side helpers for `channelSystemMessage` payloads.
//!
//! Mirrors plain-app `ChannelSystemMessageSender` (see
//! `plain-app/.../channel/ChannelSystemMessageSender.kt`). Each
//! function builds the correct JSON payload and posts it to the
//! peer's `/peer_graphql` endpoint via the same transport used by
//! `createChatItem`.
//!
//! `kp_bytes` is the local Ed25519 keypair (decoded from
//! `AppIdentity.ed25519_keypair`) used to sign every outbound
//! message so the receiver can authenticate the sender. The shared
//! symmetric key is looked up from `key_cache` for the destination
//! peer; if absent, the request is silently skipped (mirroring
//! Android's "peer unreachable" behaviour).

use serde_json::{json, Value};

use crate::local::db::{ChatDb, DChannel, DPeer};
use crate::local::graphql::context::PeerKeyCache;

use super::messages::*;

// ── Public API ─────────────────────────────────────────────────────────────

/// Send a `channel_invite` to a single peer.
#[allow(dead_code)]
pub async fn send_invite(
    channel: &DChannel,
    peer: &DPeer,
    kp_bytes: &[u8],
    db: &ChatDb,
    key_cache: &PeerKeyCache,
) -> bool {
    let member_peers = build_member_peers(channel, db);
    let payload = json!({
        "channelId": channel.id,
        "channelName": channel.name,
        "owner": channel.owner,
        "key": "", // Reserved for future use; current DChannel has no per-channel key.
        "members": decode_members(&channel.members),
        "memberPeers": member_peers,
        "version": channel.version,
    });
    deliver_type(peer, kp_bytes, TYPE_INVITE, &payload, key_cache).await
}

/// Send `channel_invite_accept` to the channel owner.
pub async fn send_invite_accept(
    channel_id: &str,
    owner_peer: &DPeer,
    kp_bytes: &[u8],
    public_key: &str,
    name: &str,
    device_type: &str,
    key_cache: &PeerKeyCache,
) -> bool {
    let payload = json!({
        "channelId": channel_id,
        "publicKey": public_key,
        "name": name,
        "deviceType": device_type,
    });
    deliver_type(owner_peer, kp_bytes, TYPE_INVITE_ACCEPT, &payload, key_cache).await
}

/// Send `channel_invite_decline` to the channel owner.
pub async fn send_invite_decline(
    channel_id: &str,
    owner_peer: &DPeer,
    kp_bytes: &[u8],
    key_cache: &PeerKeyCache,
) -> bool {
    let payload = json!({ "channelId": channel_id });
    deliver_type(owner_peer, kp_bytes, TYPE_INVITE_DECLINE, &payload, key_cache).await
}

/// Broadcast a `channel_update` to every member of the channel (excluding self).
#[allow(dead_code)]
pub async fn broadcast_update(
    channel: &DChannel,
    client_id: &str,
    kp_bytes: &[u8],
    db: &ChatDb,
    key_cache: &PeerKeyCache,
) {
    let member_peers = build_member_peers(channel, db);
    let payload = json!({
        "channelId": channel.id,
        "channelName": channel.name,
        "members": decode_members(&channel.members),
        "memberPeers": member_peers,
        "version": channel.version,
    });
    let member_ids = member_ids_excluding(channel, client_id);
    for member_id in member_ids {
        if let Some(peer) = db.get_peer_by_id(&member_id) {
            let _ = deliver_type(&peer, kp_bytes, TYPE_UPDATE, &payload, key_cache).await;
        }
    }
}

/// Send `channel_kick` to a single peer.
#[allow(dead_code)]
pub async fn send_kick(
    channel_id: &str,
    peer: &DPeer,
    kp_bytes: &[u8],
    key_cache: &PeerKeyCache,
) -> bool {
    let payload = json!({ "channelId": channel_id });
    deliver_type(peer, kp_bytes, TYPE_KICK, &payload, key_cache).await
}

/// Broadcast a `channel_kick` to every member of the channel (excluding self).
/// Used when the owner deletes the channel entirely.
#[allow(dead_code)]
pub async fn broadcast_kick(
    channel: &DChannel,
    client_id: &str,
    kp_bytes: &[u8],
    db: &ChatDb,
    key_cache: &PeerKeyCache,
) {
    let payload = json!({ "channelId": channel.id });
    let member_ids = member_ids_excluding(channel, client_id);
    for member_id in member_ids {
        if let Some(peer) = db.get_peer_by_id(&member_id) {
            let _ = deliver_type(&peer, kp_bytes, TYPE_KICK, &payload, key_cache).await;
        }
    }
}

/// Send `channel_leave` to the channel owner.
#[allow(dead_code)]
pub async fn send_leave(
    channel_id: &str,
    owner_peer: &DPeer,
    kp_bytes: &[u8],
    key_cache: &PeerKeyCache,
) -> bool {
    let payload = json!({ "channelId": channel_id });
    deliver_type(owner_peer, kp_bytes, TYPE_LEAVE, &payload, key_cache).await
}

// ── Internals ──────────────────────────────────────────────────────────────

/// Build the `MemberPeerInfo` array for the current members of the channel.
#[allow(dead_code)]
fn build_member_peers(channel: &DChannel, db: &ChatDb) -> Vec<Value> {
    decode_members(&channel.members)
        .into_iter()
        .filter_map(|m| {
            let id = m["id"].as_str()?.to_string();
            db.get_peer_by_id(&id).map(|p| {
                json!({
                    "id": p.id,
                    "name": p.name,
                    "publicKey": p.public_key,
                    "deviceType": p.device_type,
                    "ip": p.ip,
                    "port": p.port,
                })
            })
        })
        .collect()
}

#[allow(dead_code)]
fn member_ids_excluding(channel: &DChannel, exclude_id: &str) -> Vec<String> {
    decode_members(&channel.members)
        .into_iter()
        .filter_map(|m| {
            let id = m["id"].as_str()?.to_string();
            if id == exclude_id {
                None
            } else {
                Some(id)
            }
        })
        .collect()
}

/// Send a `channelSystemMessage` GraphQL mutation to the peer. Returns
/// `true` if the peer acknowledged the request, `false` otherwise
/// (peer unreachable, key missing, network error, …).
async fn deliver_type(
    peer: &DPeer,
    kp_bytes: &[u8],
    msg_type: &str,
    payload: &Value,
    key_cache: &PeerKeyCache,
) -> bool {
    let key = {
        let cache = key_cache.read().unwrap();
        cache.get(&peer.id).cloned()
    };
    let Some(key) = key else {
        log::debug!(
            "[channel] no shared key for peer {}, skipping {msg_type}",
            peer.id
        );
        return false;
    };
    let payload_str = serde_json::to_string(payload).unwrap_or_default();

    // Borrow the existing delivery helper from graphql/peer so we don't
    // duplicate the encrypt/sign/POST/verify pipeline.
    super::super::graphql::peer::deliver_channel_system_message(
        peer,
        &key,
        kp_bytes,
        msg_type,
        &payload_str,
    )
    .await
}
