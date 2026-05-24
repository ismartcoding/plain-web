//! Chat message mutation handlers.

use crate::local::crypto::base64_decode;
use crate::local::db::{ChatDb, DChat, DDeviceIdentity};
use serde_json::{json, Value};
use std::sync::Arc;
use tokio::sync::broadcast;
use super::context::{PeerKeyCache, WsEvent, WS_MESSAGE_CREATED, WS_MESSAGE_DELETED, WS_MESSAGE_UPDATED};
use super::models::chat_model;
use super::peer::{deliver_to_peer, peer_graphql_urls};

/// Handle `sendChatItem` — write to local DB, then deliver to peer asynchronously.
pub fn send_chat_item(
    db: &ChatDb,
    identity: &DDeviceIdentity,
    peer_key_cache: &PeerKeyCache,
    variables: &Value,
    event_tx: &broadcast::Sender<WsEvent>,
) -> Value {
    let to_id_raw = variables.get("toId").and_then(Value::as_str).unwrap_or("local");
    let content = variables
        .get("content")
        .and_then(Value::as_str)
        .unwrap_or(r#"{"type":"text","value":{"text":""}}"#);

    let is_channel = to_id_raw.starts_with("channel:");
    let is_peer = to_id_raw.starts_with("peer:");
    let to_id = if is_channel {
        ""
    } else if is_peer {
        to_id_raw.strip_prefix("peer:").unwrap_or(to_id_raw)
    } else {
        to_id_raw
    };
    let channel_id = if is_channel {
        to_id_raw.strip_prefix("channel:").unwrap_or("")
    } else {
        ""
    };

    let pending = is_peer && to_id != "local";
    let mut chat = DChat::new("me", to_id, channel_id, content);
    if pending {
        chat.status = "pending".to_string();
    }
    db.insert_chat(&chat);

    if pending {
        if let Some(peer) = db.get_peer_by_id(to_id) {
            let key_raw = {
                let cache = peer_key_cache.read().unwrap();
                cache.get(to_id).cloned()
            }
            .or_else(|| {
                let raw = base64_decode(&peer.key);
                if raw.len() == 32 { Some(raw) } else { None }
            });
            if let Some(key) = key_raw {
                let chat_id = chat.id.clone();
                let content_str = content.to_string();
                let peer_urls = peer_graphql_urls(&peer);
                let client_id = identity.client_id.clone();
                let kp_bytes = base64_decode(&identity.ed25519_keypair);
                let db2 = Arc::new(db.clone());
                let event_tx2 = event_tx.clone();
                tauri::async_runtime::spawn(async move {
                    let result = deliver_to_peer(
                        &peer_urls, &key, &client_id, &kp_bytes, &content_str, None,
                    )
                    .await;
                    let new_status = if result { "sent" } else { "failed" };
                    db2.update_chat_status(&chat_id, new_status);
                    if let Some(updated) = db2.get_chat_by_id(&chat_id) {
                        let _ = event_tx2.send(WsEvent {
                            event_type: WS_MESSAGE_UPDATED,
                            payload: json!([chat_model(&updated)]).to_string(),
                        });
                    }
                });
            }
        }
    }

    let model = chat_model(&chat);
    let _ = event_tx.send(WsEvent {
        event_type: WS_MESSAGE_CREATED,
        payload: json!([model]).to_string(),
    });
    json!({ "sendChatItem": [model] })
}

/// Handle `deleteChatItem`.
pub fn delete_chat_item(
    db: &ChatDb,
    variables: &Value,
    event_tx: &broadcast::Sender<WsEvent>,
) -> Value {
    let id = variables.get("id").and_then(Value::as_str).unwrap_or_default();
    db.delete_chat(id);
    let _ = event_tx.send(WsEvent {
        event_type: WS_MESSAGE_DELETED,
        payload: json!([id]).to_string(),
    });
    json!({ "deleteChatItem": true })
}

/// Handle `retryChatItem`.
pub fn retry_chat_item(
    db: &ChatDb,
    variables: &Value,
    event_tx: &broadcast::Sender<WsEvent>,
) -> Value {
    let id = variables.get("id").and_then(Value::as_str).unwrap_or_default();
    let updated = db.update_chat_status(id, "sent").map(|c| chat_model(&c));
    if let Some(ref m) = updated {
        let _ = event_tx.send(WsEvent {
            event_type: WS_MESSAGE_UPDATED,
            payload: json!([m]).to_string(),
        });
    }
    json!({ "retryChatItem": updated })
}

/// Handle `createChatItem` sent by a remote peer to our `/peer_graphql` endpoint.
/// The caller (server.rs) has already authenticated and decrypted the request.
pub fn create_chat_item_from_peer(
    db: &ChatDb,
    variables: &Value,
    event_tx: &broadcast::Sender<WsEvent>,
) -> Value {
    let content = variables
        .get("content")
        .and_then(Value::as_str)
        .unwrap_or(r#"{"type":"text","value":{"text":""}}"#);
    let from_id = variables.get("fromId").and_then(Value::as_str).unwrap_or("");
    let channel_id = variables.get("channelId").and_then(Value::as_str).unwrap_or("");
    let to_id = if channel_id.is_empty() { "me" } else { "" };

    let chat = DChat::new(from_id, to_id, channel_id, content);
    db.insert_chat(&chat);
    let model = chat_model(&chat);
    let _ = event_tx.send(WsEvent {
        event_type: WS_MESSAGE_CREATED,
        payload: json!([model]).to_string(),
    });
    json!({ "createChatItem": [model] })
}
