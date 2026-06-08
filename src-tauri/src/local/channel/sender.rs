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
//! message so the receiver can authenticate the sender.
//!
//! ## Encryption layer
//!
//! For channel system messages the wire is encrypted with the
//! per-channel ChaCha20 key (`channel.key` from `DChannel`). The
//! `c-cid` HTTP header is set to the channel id so the receiver can
//! pick `channel_key_cache[c-cid]` to decrypt, rather than the
//! peer's shared key. This mirrors Kotlin's
//! `PeerGraphQLClient.sendChannelSystemMessage`, which switches key
//! based on `channelId.isNotEmpty()`.
//!
//! Callers pass the per-channel key (already base64-decoded) as
//! `channel_key`; for the rare cases where it is absent (e.g. the
//! very first `channel_invite` before the receiver has stored the
//! key), the function falls back to the peer's shared key so the
//! delivery can still complete — receivers then re-encrypt their
//! responses on the same channel key once they have it.

use serde_json::{json, Value};

use crate::crypto::base64_encode;
use crate::local::db::{ChatDb, DChannel, DPeer};
use crate::local::graphql::context::PeerKeyCache;

use super::messages::*;

// ── Public API ─────────────────────────────────────────────────────────────

/// Send a `channel_invite` to a single peer. The per-channel
/// ChaCha20 key is embedded in the payload so the invitee can
/// decrypt subsequent channel traffic, and the wire itself is
/// encrypted with that same key.
#[allow(dead_code)]
pub async fn send_invite(
    channel: &DChannel,
    peer: &DPeer,
    kp_bytes: &[u8],
    db: &ChatDb,
    key_cache: &PeerKeyCache,
    channel_key: &[u8],
) -> bool {
    let member_peers = build_member_peers(channel, db);
    let payload = json!({
        "channelId": channel.id,
        "channelName": channel.name,
        "owner": channel.owner,
        "key": channel.key,
        "members": decode_members(&channel.members),
        "memberPeers": member_peers,
        "version": channel.version,
    });
    deliver_type(
        peer,
        kp_bytes,
        TYPE_INVITE,
        &payload,
        Some(&channel.id),
        channel_key,
        key_cache,
    )
    .await
}

/// Send `channel_invite_accept` to the channel owner. Wire is
/// encrypted with the per-channel key (the owner knows the channel
/// key by virtue of having created the channel).
#[allow(dead_code, clippy::too_many_arguments)]
pub async fn send_invite_accept(
    channel_id: &str,
    owner_peer: &DPeer,
    kp_bytes: &[u8],
    public_key: &str,
    name: &str,
    device_type: &str,
    channel_key: &[u8],
    key_cache: &PeerKeyCache,
) -> bool {
    let payload = json!({
        "channelId": channel_id,
        "publicKey": public_key,
        "name": name,
        "deviceType": device_type,
    });
    deliver_type(
        owner_peer,
        kp_bytes,
        TYPE_INVITE_ACCEPT,
        &payload,
        Some(channel_id),
        channel_key,
        key_cache,
    )
    .await
}

/// Send `channel_invite_decline` to the channel owner.
#[allow(dead_code)]
pub async fn send_invite_decline(
    channel_id: &str,
    owner_peer: &DPeer,
    kp_bytes: &[u8],
    channel_key: &[u8],
    key_cache: &PeerKeyCache,
) -> bool {
    let payload = json!({ "channelId": channel_id });
    deliver_type(
        owner_peer,
        kp_bytes,
        TYPE_INVITE_DECLINE,
        &payload,
        Some(channel_id),
        channel_key,
        key_cache,
    )
    .await
}

/// Broadcast a `channel_update` to every member of the channel
/// (excluding self). Wire is encrypted with the channel key.
#[allow(dead_code)]
pub async fn broadcast_update(
    channel: &DChannel,
    client_id: &str,
    kp_bytes: &[u8],
    db: &ChatDb,
    key_cache: &PeerKeyCache,
    channel_key: &[u8],
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
            let _ = deliver_type(
                &peer,
                kp_bytes,
                TYPE_UPDATE,
                &payload,
                Some(&channel.id),
                channel_key,
                key_cache,
            )
            .await;
        }
    }
}

/// Send `channel_kick` to a single peer. Wire is encrypted with the
/// channel key.
#[allow(dead_code)]
pub async fn send_kick(
    channel_id: &str,
    peer: &DPeer,
    kp_bytes: &[u8],
    channel_key: &[u8],
    key_cache: &PeerKeyCache,
) -> bool {
    let payload = json!({ "channelId": channel_id });
    deliver_type(
        peer,
        kp_bytes,
        TYPE_KICK,
        &payload,
        Some(channel_id),
        channel_key,
        key_cache,
    )
    .await
}

/// Broadcast a `channel_kick` to every member of the channel
/// (excluding self). Used when the owner deletes the channel
/// entirely. Wire is encrypted with the channel key.
#[allow(dead_code)]
pub async fn broadcast_kick(
    channel: &DChannel,
    client_id: &str,
    kp_bytes: &[u8],
    db: &ChatDb,
    key_cache: &PeerKeyCache,
    channel_key: &[u8],
) {
    let payload = json!({ "channelId": channel.id });
    let member_ids = member_ids_excluding(channel, client_id);
    for member_id in member_ids {
        if let Some(peer) = db.get_peer_by_id(&member_id) {
            let _ = deliver_type(
                &peer,
                kp_bytes,
                TYPE_KICK,
                &payload,
                Some(&channel.id),
                channel_key,
                key_cache,
            )
            .await;
        }
    }
}

/// Send `channel_leave` to the channel owner. Wire is encrypted with
/// the channel key.
#[allow(dead_code)]
pub async fn send_leave(
    channel_id: &str,
    owner_peer: &DPeer,
    kp_bytes: &[u8],
    channel_key: &[u8],
    key_cache: &PeerKeyCache,
) -> bool {
    let payload = json!({ "channelId": channel_id });
    deliver_type(
        owner_peer,
        kp_bytes,
        TYPE_LEAVE,
        &payload,
        Some(channel_id),
        channel_key,
        key_cache,
    )
    .await
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

/// Send a `channelSystemMessage` GraphQL mutation to the peer.
///
/// When `channel_id_opt` is `Some`, the request is sent over the
/// per-channel key (passed in as `channel_key`) and the `c-cid`
/// header is set so the receiver can pick the matching key from its
/// own `channel_key_cache`. If we don't have the channel key locally
/// for any reason we fall back to the peer's shared key.
async fn deliver_type(
    peer: &DPeer,
    kp_bytes: &[u8],
    msg_type: &str,
    payload: &Value,
    channel_id_opt: Option<&str>,
    channel_key: &[u8],
    key_cache: &PeerKeyCache,
) -> bool {
    // Pick the transport key. Prefer the channel key when sending a
    // channel system message; fall back to the peer's shared key if
    // the channel key is empty (shouldn't happen for normal flows
    // but keeps the system robust against partially-migrated DBs).
    let key: Vec<u8> = if !channel_id_opt.map(str::is_empty).unwrap_or(true) && !channel_key.is_empty() {
        channel_key.to_vec()
    } else {
        let cache = key_cache.read().unwrap();
        match cache.get(&peer.id).cloned() {
            Some(k) => k,
            None => {
                log::debug!(
                    "[channel] no shared key for peer {}, skipping {msg_type}",
                    peer.id
                );
                return false;
            }
        }
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
        channel_id_opt,
    )
    .await
}

#[allow(dead_code)]
pub fn encode_channel_key(raw: &[u8]) -> String {
    base64_encode(raw)
}
