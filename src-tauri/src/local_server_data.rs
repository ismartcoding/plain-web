//! GraphQL dispatch layer for the local HTTP server.
//! Backed by SQLite via ChatDb. Sends WebSocket events on mutations.

use crate::local_crypto::xchacha_encrypt;
use crate::local_db::{now_iso, ChatDb, DChannel, DChat};
use serde_json::{json, Value};
use std::sync::Arc;
use tokio::sync::broadcast;

// ---------------------------------------------------------------------------
// WebSocket event types (matches plain-app EventType in app-socket.ts)
// ---------------------------------------------------------------------------

pub const WS_MESSAGE_CREATED: i32 = 1;
pub const WS_MESSAGE_DELETED: i32 = 2;
pub const WS_MESSAGE_UPDATED: i32 = 3;
pub const WS_CHANNELS_UPDATED: i32 = 18;

#[derive(Clone, Debug)]
pub struct WsEvent {
    pub event_type: i32,
    /// JSON payload — will be encrypted when sent over WebSocket.
    pub payload: String,
}

// ---------------------------------------------------------------------------
// GraphQL entry point
// ---------------------------------------------------------------------------

pub fn execute_graphql(
    request: Value,
    db: Arc<ChatDb>,
    token: &str,
    event_tx: &broadcast::Sender<WsEvent>,
    port: u16,
    https_port: u16,
) -> Value {
    let query = request.get("query").and_then(Value::as_str).unwrap_or_default();
    let variables = request.get("variables").cloned().unwrap_or_else(|| json!({}));
    match execute_operation(query, &variables, db, token, event_tx, port, https_port) {
        Some(data) => json!({ "data": data }),
        None => json!({ "data": null, "errors": [{ "message": "local_api_unsupported" }] }),
    }
}

fn execute_operation(
    query: &str,
    variables: &Value,
    db: Arc<ChatDb>,
    token: &str,
    event_tx: &broadcast::Sender<WsEvent>,
    port: u16,
    https_port: u16,
) -> Option<Value> {
    let op = operation_name(query);

    // ── Queries ──────────────────────────────────────────────────────────────
    if op == "homeStats" {
        return Some(json!({
            "smsCount": 0, "contactCount": 0, "callCount": 0,
            "imageCount": 0, "audioCount": 0, "videoCount": 0,
            "packageCount": 0, "noteCount": 0, "docCount": 0,
            "feedEntryCount": 0, "mounts": []
        }));
    }
    if has_field(query, "app") {
        return Some(json!({ "app": local_app(token, port, https_port) }));
    }
    if op == "chatItems" || has_field(query, "chatItems") {
        let id = variables.get("id").and_then(Value::as_str).unwrap_or("local");
        let items = db.get_chats(id);
        return Some(json!({ "chatItems": items.iter().map(chat_model).collect::<Vec<_>>() }));
    }
    if op == "peers" || has_field(query, "peers") {
        return Some(json!({ "peers": [] }));
    }
    if op == "chatChannels" || has_field(query, "chatChannels") {
        let channels = db.get_channels();
        return Some(json!({ "chatChannels": channels.iter().map(channel_model).collect::<Vec<_>>() }));
    }

    // ── Mutations ─────────────────────────────────────────────────────────────
    match op.as_str() {
        "sendChatItem" => Some(send_chat_item(&db, variables, event_tx)),
        "deleteChatItem" => Some(delete_chat_item(&db, variables, event_tx)),
        "retryChatItem" => Some(retry_chat_item(&db, variables, event_tx)),
        "createChatChannel" => Some(create_chat_channel(&db, variables, event_tx)),
        "updateChatChannel" => Some(update_chat_channel(&db, variables, event_tx)),
        "deleteChatChannel" => Some(delete_chat_channel(&db, variables, event_tx)),
        "leaveChatChannel" => Some(leave_chat_channel(&db, variables, event_tx)),
        "acceptChatChannelInvite" => Some(json!({ "acceptChatChannelInvite": true })),
        "declineChatChannelInvite" => Some(json!({ "declineChatChannelInvite": true })),
        // Stub-out operations not supported in local mode
        "images" | "imageCount" => Some(json!({ "images": [], "imageCount": 0 })),
        "videos" | "videoCount" => Some(json!({ "videos": [], "videoCount": 0 })),
        "audios" | "audioCount" => Some(json!({ "items": [], "total": 0 })),
        "docs" | "docCount" => Some(json!({ "items": [], "total": 0 })),
        "files" | "recentFiles" => Some(json!({ "files": [], "recentFiles": [] })),
        "notes" | "noteCount" => Some(json!({ "notes": [], "noteCount": 0 })),
        "feeds" | "feedEntries" | "feedEntryCount" => {
            Some(json!({ "feeds": [], "items": [], "total": 0 }))
        }
        "feedsTags" => Some(json!({ "tags": [], "feeds": [] })),
        "bucketsTags" => Some(json!({ "tags": [], "mediaBuckets": [] })),
        "mounts" => Some(json!({ "mounts": [] })),
        "tags" => Some(json!({ "tags": [] })),
        "mediaBuckets" => Some(json!({ "mediaBuckets": [] })),
        _ => None,
    }
}

// ---------------------------------------------------------------------------
// Mutation handlers
// ---------------------------------------------------------------------------

fn send_chat_item(db: &ChatDb, variables: &Value, event_tx: &broadcast::Sender<WsEvent>) -> Value {
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

    let chat = DChat::new("me", to_id, channel_id, content);
    db.insert_chat(&chat);
    let model = chat_model(&chat);

    let _ = event_tx.send(WsEvent {
        event_type: WS_MESSAGE_CREATED,
        payload: json!([model]).to_string(),
    });

    json!({ "sendChatItem": [model] })
}

fn delete_chat_item(db: &ChatDb, variables: &Value, event_tx: &broadcast::Sender<WsEvent>) -> Value {
    let id = variables.get("id").and_then(Value::as_str).unwrap_or_default();
    db.delete_chat(id);
    let _ = event_tx.send(WsEvent {
        event_type: WS_MESSAGE_DELETED,
        payload: json!([id]).to_string(),
    });
    json!({ "deleteChatItem": true })
}

fn retry_chat_item(db: &ChatDb, variables: &Value, event_tx: &broadcast::Sender<WsEvent>) -> Value {
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

fn create_chat_channel(
    db: &ChatDb,
    variables: &Value,
    event_tx: &broadcast::Sender<WsEvent>,
) -> Value {
    let name = variables.get("name").and_then(Value::as_str).unwrap_or_default().trim();
    let channel = DChannel::new(name);
    db.insert_channel(&channel);
    let model = channel_model(&channel);
    let _ = event_tx.send(WsEvent {
        event_type: WS_CHANNELS_UPDATED,
        payload: "{}".to_string(),
    });
    json!({ "createChatChannel": model })
}

fn update_chat_channel(
    db: &ChatDb,
    variables: &Value,
    event_tx: &broadcast::Sender<WsEvent>,
) -> Value {
    let id = variables.get("id").and_then(Value::as_str).unwrap_or_default();
    let result = db.get_channel_by_id(id).map(|mut ch| {
        ch.name = variables
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .trim()
            .to_string();
        ch.version += 1;
        ch.updated_at = now_iso();
        db.update_channel(&ch);
        channel_model(&ch)
    });
    if result.is_some() {
        let _ = event_tx.send(WsEvent {
            event_type: WS_CHANNELS_UPDATED,
            payload: "{}".to_string(),
        });
    }
    json!({ "updateChatChannel": result })
}

fn delete_chat_channel(
    db: &ChatDb,
    variables: &Value,
    event_tx: &broadcast::Sender<WsEvent>,
) -> Value {
    let id = variables.get("id").and_then(Value::as_str).unwrap_or_default();
    db.delete_chats_by_channel(id);
    db.delete_channel(id);
    let _ = event_tx.send(WsEvent {
        event_type: WS_CHANNELS_UPDATED,
        payload: "{}".to_string(),
    });
    json!({ "deleteChatChannel": true })
}

fn leave_chat_channel(
    db: &ChatDb,
    variables: &Value,
    event_tx: &broadcast::Sender<WsEvent>,
) -> Value {
    let id = variables.get("id").and_then(Value::as_str).unwrap_or_default();
    if let Some(mut ch) = db.get_channel_by_id(id) {
        ch.status = "left".to_string();
        ch.updated_at = now_iso();
        db.update_channel(&ch);
        let _ = event_tx.send(WsEvent {
            event_type: WS_CHANNELS_UPDATED,
            payload: "{}".to_string(),
        });
    }
    json!({ "leaveChatChannel": true })
}

// ---------------------------------------------------------------------------
// Serialisation helpers
// ---------------------------------------------------------------------------

fn chat_model(chat: &DChat) -> Value {
    // data field: MessageText with empty link-preview ids for plain text.
    let data = Value::Null;
    json!({
        "id": chat.id,
        "fromId": chat.from_id,
        "toId": chat.to_id,
        "channelId": chat.channel_id,
        "content": chat.content,
        "createdAt": chat.created_at,
        "updatedAt": chat.updated_at,
        "data": data,
        "status": chat.status,
        "statusData": chat.status_data,
    })
}

fn channel_model(ch: &DChannel) -> Value {
    let members: Value = serde_json::from_str(&ch.members).unwrap_or_else(|_| json!([]));
    json!({
        "id": ch.id,
        "name": ch.name,
        "owner": ch.owner,
        "members": members,
        "version": ch.version,
        "status": ch.status,
        "createdAt": ch.created_at,
        "updatedAt": ch.updated_at,
    })
}

fn local_app(token: &str, port: u16, https_port: u16) -> Value {
    json!({
        "usbConnected": false,
        "urlToken": token,
        "httpPort": port,
        "httpsPort": https_port,
        "appDir": "",
        "deviceName": "Local",
        "battery": "",
        "appVersion": "",
        "osVersion": "",
        "channel": "LOCAL",
        "permissions": [],
        "audios": [],
        "audioCurrent": "",
        "audioMode": "",
        "sdcardPath": "",
        "usbDiskPaths": [],
        "internalStoragePath": "",
        "downloadsDir": "",
        "developerMode": false,
        "favoriteFolders": []
    })
}

// ---------------------------------------------------------------------------
// Query parsing helpers
// ---------------------------------------------------------------------------

pub fn operation_name(query: &str) -> String {
    let words: Vec<&str> = query.split_whitespace().collect();
    for i in 0..words.len().saturating_sub(1) {
        if words[i] == "query" || words[i] == "mutation" {
            return words[i + 1]
                .split(['(', '{'])
                .next()
                .unwrap_or_default()
                .to_string();
        }
    }
    String::new()
}

pub fn has_field(query: &str, field: &str) -> bool {
    query
        .split(|c: char| !c.is_alphanumeric() && c != '_')
        .any(|it| it == field)
}

// ---------------------------------------------------------------------------
// WebSocket message encoding: [4-byte i32 BE type][xchacha encrypted payload]
// ---------------------------------------------------------------------------

pub fn encode_ws_event(ev: &WsEvent, token: &str) -> Option<Vec<u8>> {
    let encrypted = xchacha_encrypt(token, ev.payload.as_bytes())?;
    let mut msg = Vec::with_capacity(4 + encrypted.len());
    msg.extend_from_slice(&ev.event_type.to_be_bytes());
    msg.extend_from_slice(&encrypted);
    Some(msg)
}
