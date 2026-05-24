//! Local GraphQL server — entry point and operation dispatcher.
//!
//! Sub-modules:
//!   context  — shared types (WsEvent, PeerKeyCache, WS_* constants)
//!   models   — JSON serialisation helpers
//!   parse    — lightweight query-string parsing
//!   query    — read-only query handlers
//!   chat     — chat message mutation handlers
//!   channel  — chat channel mutation handlers
//!   peer     — peer-to-peer delivery over HTTPS

pub mod context;
pub mod models;
pub mod parse;
pub mod query;
pub mod chat;
pub mod channel;
pub mod peer;

// Re-export the types that server.rs needs directly.
pub use context::{encode_ws_event, new_peer_key_cache, refresh_peer_key_cache, PeerKeyCache, WsEvent};

use crate::local::db::{ChatDb, DDeviceIdentity};
use parse::operation_name;
use serde_json::{json, Value};
use std::sync::Arc;
use tokio::sync::broadcast;

/// Main entry point: execute a decrypted GraphQL request and return a JSON response.
pub fn execute_graphql(
    request: Value,
    db: Arc<ChatDb>,
    identity: Arc<DDeviceIdentity>,
    peer_key_cache: &PeerKeyCache,
    token: &str,
    event_tx: &broadcast::Sender<WsEvent>,
    port: u16,
    https_port: u16,
) -> Value {
    let query_str = request.get("query").and_then(Value::as_str).unwrap_or_default();
    let variables = request.get("variables").cloned().unwrap_or_else(|| json!({}));
    match dispatch(query_str, &variables, db, identity, peer_key_cache, token, event_tx, port, https_port) {
        Some(data) => json!({ "data": data }),
        None => json!({ "data": null, "errors": [{ "message": "local_api_unsupported" }] }),
    }
}

fn dispatch(
    query_str: &str,
    variables: &Value,
    db: Arc<ChatDb>,
    identity: Arc<DDeviceIdentity>,
    peer_key_cache: &PeerKeyCache,
    token: &str,
    event_tx: &broadcast::Sender<WsEvent>,
    port: u16,
    https_port: u16,
) -> Option<Value> {
    let op = operation_name(query_str);

    // ── Queries ───────────────────────────────────────────────────────────────
    if let Some(v) = query::handle(&op, query_str, variables, &db, token, port, https_port, &identity.device_name) {
        return Some(v);
    }

    // ── Mutations ─────────────────────────────────────────────────────────────
    match op.as_str() {
        "sendChatItem"   => Some(chat::send_chat_item(&db, &identity, peer_key_cache, variables, event_tx)),
        "createChatItem" => Some(chat::create_chat_item_from_peer(&db, variables, event_tx)),
        "deleteChatItem" => Some(chat::delete_chat_item(&db, variables, event_tx)),
        "retryChatItem"  => Some(chat::retry_chat_item(&db, variables, event_tx)),

        "createChatChannel"        => Some(channel::create_chat_channel(&db, variables, event_tx)),
        "updateChatChannel"        => Some(channel::update_chat_channel(&db, variables, event_tx)),
        "deleteChatChannel"        => Some(channel::delete_chat_channel(&db, variables, event_tx)),
        "leaveChatChannel"         => Some(channel::leave_chat_channel(&db, variables, event_tx)),
        "acceptChatChannelInvite"  => Some(json!({ "acceptChatChannelInvite": true })),
        "declineChatChannelInvite" => Some(json!({ "declineChatChannelInvite": true })),

        // Stubs: operations not supported in local mode
        "images" | "imageCount"  => Some(json!({ "images": [], "imageCount": 0 })),
        "videos" | "videoCount"  => Some(json!({ "videos": [], "videoCount": 0 })),
        "audios" | "audioCount"  => Some(json!({ "items": [], "total": 0 })),
        "docs"   | "docCount"    => Some(json!({ "items": [], "total": 0 })),
        "files"  | "recentFiles" => Some(json!({ "files": [], "recentFiles": [] })),
        "notes"  | "noteCount"   => Some(json!({ "notes": [], "noteCount": 0 })),
        "feeds"  | "feedEntries" | "feedEntryCount" => Some(json!({ "feeds": [], "items": [], "total": 0 })),
        "feedsTags"    => Some(json!({ "tags": [], "feeds": [] })),
        "bucketsTags"  => Some(json!({ "tags": [], "mediaBuckets": [] })),
        "mounts"       => Some(json!({ "mounts": [] })),
        "tags"         => Some(json!({ "tags": [] })),
        "mediaBuckets" => Some(json!({ "mediaBuckets": [] })),
        _ => None,
    }
}
