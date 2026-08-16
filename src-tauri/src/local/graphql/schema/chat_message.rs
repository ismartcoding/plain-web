use async_graphql::{Context, Object};
use serde_json::{json, Value};
use std::sync::Arc;

use super::super::context::{
    load_key_cache, AppCtx, WsEvent, WS_MESSAGE_CREATED, WS_MESSAGE_DELETED, WS_MESSAGE_UPDATED,
};
use super::super::peer::{deliver_to_peer, peer_graphql_urls};
use super::types::{make_file_id, ChatItem};
use plain_rs::base64_decode;
use crate::local::db::DChat;
use crate::local::enums::ChatStatus;
use crate::local::channel::chat_helper::{
    build_no_leader_status_data, build_status_data_json, compute_status, send, ChannelDeliveryResult,
    SendResult,
};
use crate::local::graphql::schema::types::chat_item_data_from_content;

/// Build the wire JSON for a single chat item, embedding the
/// resolved `data` fragment (see `chat_item_data_from_content`).
/// Used for both GraphQL responses and WS event payloads — the
/// `WS_MESSAGE_CREATED` / `WS_MESSAGE_UPDATED` consumers expect the
/// same `data` field the GraphQL `ChatItem` exposes.
///
/// `token` is the local URL token; the `data.ids` are the XChaCha20-
/// encrypted form the web's `/fs` endpoint expects to receive (see
/// `plain-app` `FileHelper.getFileId`).
pub(crate) fn chat_to_json(c: &DChat, token: &str) -> Value {
    let data = chat_item_data_from_content(&c.content, token)
        .as_ref()
        .map(|d| match d {
            super::types::ChatItemData::MessageImages(m) => {
                json!({ "__typename": "MessageImages", "ids": &m.ids })
            }
            super::types::ChatItemData::MessageFiles(m) => {
                json!({ "__typename": "MessageFiles", "ids": &m.ids })
            }
            super::types::ChatItemData::MessageText(m) => {
                json!({ "__typename": "MessageText", "ids": &m.ids })
            }
        });
    json!({
        "id": c.id, "fromId": c.from_id, "toId": c.to_id,
        "channelId": c.channel_id, "content": c.content,
        "createdAt": c.created_at, "updatedAt": c.updated_at,
        "status": c.status, "statusData": c.status_data, "data": data,
    })
}

/// Convert `fid:` URIs to `fsid:` URIs for peer delivery.
///
/// Mirrors plain-app's `DMessageContent.toPeerMessageContent()`: each
/// item's `uri` is encrypted with the local URL token and prefixed with
/// `fsid:` so the receiver can fetch it via the sender's `/fs` endpoint
/// (see `DPeer.getFileUrl` + `parseFileId`). The stored content keeps
/// the original `fid:` URIs — only the wire copy sent to the peer is
/// rewritten.
fn to_peer_content(content: &str, token: &str) -> String {
    let Ok(mut v) = serde_json::from_str::<Value>(content) else {
        return content.to_string();
    };
    let Some(items) = v
        .get_mut("value")
        .and_then(|v| v.get_mut("items"))
        .and_then(|v| v.as_array_mut())
    else {
        return content.to_string();
    };
    for item in items.iter_mut() {
        if let Some(uri) = item.get("uri").and_then(|u| u.as_str()) {
            if uri.starts_with("fid:") {
                let encrypted = make_file_id(uri, token);
                if !encrypted.is_empty() {
                    if let Some(obj) = item.as_object_mut() {
                        obj.insert("uri".to_string(), Value::String(format!("fsid:{encrypted}")));
                    }
                }
            }
        }
    }
    v.to_string()
}

fn peer_delivery_status_data(peer_id: &str, peer_name: &str, error: &str) -> String {
    json!({
        "results": [{
            "peerId": peer_id,
            "peerName": peer_name,
            "error": error,
        }]
    })
    .to_string()
}

// ── ChatSender.send equivalents ────────────────────────────────────────────

/// Mirrors `ChatSender.sendToPeer` — spawn async peer delivery and
/// update the chat status from the result.
fn spawn_peer_delivery(c: &Arc<AppCtx>, chat: &DChat) {
    let peer_id = chat.to_id.clone();
    let Some(peer) = c.db.get_peer_by_id(&peer_id) else {
        return;
    };
    let key = {
        let cache = c.peer_key_cache.read().unwrap();
        cache.get(&peer_id).cloned()
    }
    .or_else(|| {
        let raw = base64_decode(&peer.key);
        if raw.len() == 32 {
            Some(raw)
        } else {
            None
        }
    });
    let Some(key) = key else { return };

    let chat_id = chat.id.clone();
    let peer_urls = peer_graphql_urls(&peer);
    let client_id = c.identity.client_id.clone();
    let kp_bytes = base64_decode(&c.identity.ed25519_keypair);
    let content_str = to_peer_content(&chat.content, &c.token);
    let event_tx = c.event_tx.clone();
    let db = c.db.clone();
    let token = c.token.clone();
    let peer_id_for_status = peer.id.clone();
    let peer_name_for_status = peer.name.clone();
    let discover_manager = c.discover_manager.clone();
    tokio::spawn(async move {
        let delivery_result = deliver_to_peer(
            &peer_urls,
            &key,
            &client_id,
            &kp_bytes,
            &content_str,
            None,
        )
        .await;
        if delivery_result.is_err() {
            // Mirrors ChatSender.triggerPeerRediscovery: a failed send usually
            // means the peer's IP/port changed — kick an mDNS browse so the
            // reply refreshes the peer row for the next attempt/reconnect.
            discover_manager.browse();
        }
        let (new_status, status_data) = match delivery_result {
            Ok(()) => (ChatStatus::Sent, String::new()),
            Err(error) => (
                ChatStatus::Failed,
                peer_delivery_status_data(&peer_id_for_status, &peer_name_for_status, &error),
            ),
        };
        if let Some(updated) = db.update_chat_status_and_data(&chat_id, new_status, &status_data) {
            let _ = event_tx.send(WsEvent {
                event_type: WS_MESSAGE_UPDATED,
                payload: json!([chat_to_json(&updated, &token)]).to_string(),
            });
        }
    });
}

/// Mirrors `ChatSender.sendToChannel` — spawn async channel delivery
/// and update the chat status from the per-member results.
fn spawn_channel_delivery(c: &Arc<AppCtx>, chat: &DChat) {
    let channel_id = chat.channel_id.clone();
    let Some(channel) = c.db.get_channel_by_id(&channel_id) else {
        return;
    };

    let client_id = c.identity.client_id.clone();
    let kp_bytes = base64_decode(&c.identity.ed25519_keypair);
    let chat_id = chat.id.clone();
    let content_str = to_peer_content(&chat.content, &c.token);
    let db = c.db.clone();
    let event_tx = c.event_tx.clone();
    let token = c.token.clone();
    let peer_key_cache = c.peer_key_cache.clone();
    let channel_key_cache = c.channel_key_cache.clone();
    let channel_for_send = channel.clone();
    let discover_manager = c.discover_manager.clone();

    tokio::spawn(async move {
        {
            let cache = channel_key_cache.read().unwrap();
            if !cache.contains_key(&channel_for_send.id) {
                drop(cache);
                load_key_cache(&db, &peer_key_cache, &channel_key_cache);
            }
        }

        let result = send(
            &channel_for_send,
            &client_id,
            &content_str,
            &db,
            &channel_key_cache,
            &kp_bytes,
        )
        .await;

        let (status, status_data) = match result {
            SendResult::Status(results) => {
                let s = compute_status(&results);
                let d = build_status_data_json(&results);
                (s, d)
            }
            SendResult::NoLeader | SendResult::LeaderPeerMissing(_) => {
                // Mirrors ChatSender.sendToChannel: no reachable leader/member
                // means stale peer addresses — trigger an mDNS browse so the
                // peers' IP/port refresh for the next delivery/reconnect.
                discover_manager.browse();
                (ChatStatus::Failed, build_no_leader_status_data())
            }
        };

        if let Some(updated) = db.update_chat_status_and_data(&chat_id, status, &status_data) {
            let _ = event_tx.send(WsEvent {
                event_type: WS_MESSAGE_UPDATED,
                payload: json!([chat_to_json(&updated, &token)]).to_string(),
            });
        }
    });
}

/// Mirrors `ChatSender.send` — route to peer or channel delivery.
/// `ChatSender.sendToPeer` / `sendToChannel` are called based on the
/// chat item's target. Local notes (`to_id == "local"`) are skipped.
fn spawn_delivery(c: &Arc<AppCtx>, chat: &DChat) {
    if chat.to_id == "local" {
        return;
    }
    if !chat.to_id.is_empty() && chat.channel_id.is_empty() {
        spawn_peer_delivery(c, chat);
    } else if !chat.channel_id.is_empty() {
        spawn_channel_delivery(c, chat);
    }
}

#[derive(Default)]
pub struct ChatMessageMutation;

#[Object]
impl ChatMessageMutation {
    /// Send a chat item. Routes by `to_id` prefix:
    ///   * `peer:<id>`      — peer-to-peer (encrypts with peer shared key)
    ///   * `channel:<id>`   — channel (star topology, leader election)
    ///   * anything else    — treat as `to_id == ""` (local note)
    ///
    /// **Fire-and-forget**: delivery is spawned on the runtime and
    /// the final status is published via `WS_MESSAGE_UPDATED`. The
    /// mutation returns the initially-inserted `ChatItem` (status =
    /// `pending` for remote targets) so the caller can render
    /// immediately.
    async fn send_chat_item(
        &self,
        ctx: &Context<'_>,
        to_id: String,
        content: String,
    ) -> Vec<ChatItem> {
        let c = ctx.data_unchecked::<Arc<AppCtx>>().clone();

        let is_channel = to_id.starts_with("channel:");
        let is_peer = to_id.starts_with("peer:");
        let peer_id = if is_peer {
            to_id.strip_prefix("peer:").unwrap_or(&to_id).to_string()
        } else {
            String::new()
        };
        let channel_id = if is_channel {
            to_id.strip_prefix("channel:").unwrap_or("").to_string()
        } else {
            String::new()
        };
        let to = if is_peer {
            peer_id.clone()
        } else if is_channel {
            String::new()
        } else {
            to_id.clone()
        };

        let is_remote = (is_peer && !peer_id.is_empty() && peer_id != "local") || is_channel;
        let mut chat = DChat::new("me", &to, &channel_id, &content);
        if is_remote {
            chat.status = ChatStatus::Pending;
        }
        c.db.insert_chat(&chat);

        if is_remote {
            spawn_delivery(&c, &chat);
        }

        let _ = c.event_tx.send(WsEvent {
            event_type: WS_MESSAGE_CREATED,
            payload: json!([chat_to_json(&chat, &c.token)]).to_string(),
        });
        vec![ChatItem::with_data(chat, &c.token)]
    }

    /// Delete a chat item. Mirrors Kotlin's
    /// `ChatDbHelper.deleteAsync` + `DeleteChatItemViewEvent` — but
    /// we only fire `WS_MESSAGE_DELETED` (the local Android-internal
    /// event has no equivalent in the web client).
    async fn delete_chat_item(&self, ctx: &Context<'_>, id: String) -> bool {
        let c = ctx.data_unchecked::<Arc<AppCtx>>();
        if c.db.get_chat_by_id(&id).is_none() {
            return false;
        }
        c.db.delete_chat(&id);
        let _ = c.event_tx.send(WsEvent {
            event_type: WS_MESSAGE_DELETED,
            payload: json!([id]).to_string(),
        });
        true
    }

    /// Bulk-delete chats by query. Mirrors plain-app's
    /// `ChatDbHelper.deleteByIdsAsync(getIdsAsync(query))`. Supported
    /// query shapes (parsed with the same `name:value` convention as
    /// plain-app's `SearchHelper.parse`):
    ///   * `ids:<comma-separated-ids>` — delete the listed chat ids.
    ///   * `channel:<channelId>`       — delete every chat in a channel.
    ///   * `peer:<peerId>`             — delete every 1:1 chat with the peer.
    ///   * `peer:local`                — delete every local note.
    ///
    /// Emits a single `WS_MESSAGE_DELETED` event whose payload is the
    /// `ids=...` string the web's `message_deleted` handler expects.
    async fn delete_chat_items(&self, ctx: &Context<'_>, query: String) -> bool {
        let c = ctx.data_unchecked::<Arc<AppCtx>>();
        let ids = resolve_chat_ids(&c.db, &query);
        if ids.is_empty() {
            return false;
        }
        c.db.delete_chats_by_ids(&ids);
        let payload = format!("ids={}", ids.join(","));
        let _ = c.event_tx.send(WsEvent {
            event_type: WS_MESSAGE_DELETED,
            payload,
        });
        true
    }

    /// Retry a failed chat item. Mirrors Kotlin's `retryChatItem`
    /// mutation: set status to `PENDING`, emit `WS_MESSAGE_UPDATED`,
    /// then re-deliver via the same `ChatSender.send` path used by
    /// `send_chat_item`. The final status is computed from the
    /// actual delivery results.
    async fn retry_chat_item(&self, ctx: &Context<'_>, id: String) -> Option<ChatItem> {
        let c = ctx.data_unchecked::<Arc<AppCtx>>().clone();
        let chat = c.db.get_chat_by_id(&id)?;

        let _ = c.db.update_chat_status(&id, ChatStatus::Pending);
        let _ = c.event_tx.send(WsEvent {
            event_type: WS_MESSAGE_UPDATED,
            payload: json!([chat_to_json(&chat, &c.token)]).to_string(),
        });

        spawn_delivery(&c, &chat);

        c.db.get_chat_by_id(&id).map(|u| ChatItem::with_data(u, &c.token))
    }
}

/// Helper used by `chat_message` for the simpler JSON path on
/// incoming chat items from peers.
#[allow(dead_code)]
pub(crate) fn delivery_results_to_json(results: &[ChannelDeliveryResult]) -> Value {
    let arr: Vec<Value> = results.iter().map(|r| r.to_json()).collect();
    json!({ "results": arr })
}

/// Resolve a `deleteChatItems(query)` query into the list of chat ids
/// that should be removed. Mirrors plain-app's
/// `ChatDbHelper.getIdsAsync(query)`:
///   * `ids:<comma-separated-ids>` — return the listed ids verbatim.
///   * `channel:<channelId>`       — return every chat id in the channel.
///   * `peer:<peerId>`             — return every 1:1 chat id with the peer.
///   * `peer:local`                — return every local-note chat id.
///
/// Returns an empty Vec for an unrecognized / empty query.
fn resolve_chat_ids(db: &crate::local::db::ChatDb, query: &str) -> Vec<String> {
    let query = query.trim();
    if query.is_empty() {
        return vec![];
    }
    let Some((name, value)) = query.split_once(':') else {
        return vec![];
    };
    match name {
        "ids" => value
            .split(',')
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(String::from)
            .collect(),
        "channel" => db.get_chats_by_channel(value).into_iter().map(|c| c.id).collect(),
        "peer" => {
            let peer_id = if value == "local" { "local" } else { value };
            db.get_chats_by_peer(peer_id).into_iter().map(|c| c.id).collect()
        }
        _ => vec![],
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use plain_rs::xchacha_decrypt;
    use crate::local::db::ChatDb;
    use plain_rs::{base64_decode, base64_encode};
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unique_tmp_dir(label: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        let pid = std::process::id();
        std::env::temp_dir().join(format!("plainapp-resolve-{label}-{pid}-{nanos}"))
    }

    fn seed(db: &ChatDb, id: &str, from_id: &str, to_id: &str, channel_id: &str) {
        let mut chat = DChat::new(from_id, to_id, channel_id, "{}");
        chat.id = id.to_string();
        db.insert_chat(&chat);
    }

    #[test]
    fn resolve_ids_query_returns_listed_ids() {
        let db = ChatDb::open(&unique_tmp_dir("ids").join("local_chat.db")).expect("open db");
        seed(&db, "a", "me", "p", "");
        seed(&db, "b", "me", "p", "");

        let ids = resolve_chat_ids(&db, "ids:a,b");
        assert_eq!(ids, vec!["a".to_string(), "b".to_string()]);
    }

    #[test]
    fn resolve_ids_query_trims_whitespace() {
        let db = ChatDb::open(&unique_tmp_dir("trim").join("local_chat.db")).expect("open db");
        let ids = resolve_chat_ids(&db, "ids: a , b , ");
        assert_eq!(ids, vec!["a".to_string(), "b".to_string()]);
    }

    #[test]
    fn resolve_channel_query_returns_channel_chats() {
        let db = ChatDb::open(&unique_tmp_dir("chan").join("local_chat.db")).expect("open db");
        seed(&db, "a", "me", "", "ch1");
        seed(&db, "b", "me", "", "ch2");
        seed(&db, "c", "me", "", "ch1");

        let mut ids = resolve_chat_ids(&db, "channel:ch1");
        ids.sort();
        assert_eq!(ids, vec!["a".to_string(), "c".to_string()]);
    }

    #[test]
    fn resolve_peer_query_returns_both_directions() {
        let db = ChatDb::open(&unique_tmp_dir("peer").join("local_chat.db")).expect("open db");
        seed(&db, "a", "me", "p1", "");
        seed(&db, "b", "p1", "me", "");
        seed(&db, "c", "me", "p2", "");

        let mut ids = resolve_chat_ids(&db, "peer:p1");
        ids.sort();
        assert_eq!(ids, vec!["a".to_string(), "b".to_string()]);
    }

    #[test]
    fn resolve_peer_local_query_returns_local_notes() {
        let db = ChatDb::open(&unique_tmp_dir("local").join("local_chat.db")).expect("open db");
        seed(&db, "a", "me", "local", "");
        seed(&db, "b", "me", "p1", "");

        let ids = resolve_chat_ids(&db, "peer:local");
        assert_eq!(ids, vec!["a".to_string()]);
    }

    #[test]
    fn resolve_unknown_query_returns_empty() {
        let db = ChatDb::open(&unique_tmp_dir("unknown").join("local_chat.db")).expect("open db");
        seed(&db, "a", "me", "p", "");

        assert!(resolve_chat_ids(&db, "unknown:foo").is_empty());
        assert!(resolve_chat_ids(&db, "").is_empty());
        assert!(resolve_chat_ids(&db, "nocolon").is_empty());
    }

    #[test]
    fn to_peer_content_converts_fid_to_fsid() {
        let token_raw = [99u8; 32];
        let token = base64_encode(&token_raw);
        let content = json!({
            "type": "images",
            "value": {
                "items": [
                    {"uri": "fid:abcdef0123456789.jpg", "fileName": "cat.jpg", "size": 1234}
                ]
            }
        })
        .to_string();

        let peer_content = to_peer_content(&content, &token);
        let v: Value = serde_json::from_str(&peer_content).unwrap();
        let uri = v["value"]["items"][0]["uri"].as_str().unwrap();
        assert!(uri.starts_with("fsid:"), "uri should be fsid: prefix, got: {uri}");

        // The encrypted part (after fsid:) must round-trip through
        // xchacha_decrypt to the original fid: URI.
        let encrypted_b64 = uri.strip_prefix("fsid:").unwrap();
        let encrypted = base64_decode(encrypted_b64);
        let plaintext = xchacha_decrypt(&token, &encrypted).expect("must decrypt");
        let plaintext_str = std::str::from_utf8(&plaintext).unwrap();
        assert_eq!(plaintext_str, "fid:abcdef0123456789.jpg");
    }

    #[test]
    fn to_peer_content_preserves_non_fid_uris() {
        let token = base64_encode(&[1u8; 32]);
        let content = json!({
            "type": "files",
            "value": {
                "items": [
                    {"uri": "https://example.com/file.pdf", "fileName": "doc.pdf", "size": 5678}
                ]
            }
        })
        .to_string();

        let peer_content = to_peer_content(&content, &token);
        let v: Value = serde_json::from_str(&peer_content).unwrap();
        let uri = v["value"]["items"][0]["uri"].as_str().unwrap();
        assert_eq!(uri, "https://example.com/file.pdf");
    }

    #[test]
    fn to_peer_content_passthrough_on_invalid_json() {
        let token = base64_encode(&[1u8; 32]);
        let content = "not json at all";
        assert_eq!(to_peer_content(content, &token), content);
    }
}
