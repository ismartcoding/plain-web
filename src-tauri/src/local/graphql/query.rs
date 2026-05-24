//! Query handlers — read-only operations that return data from the local DB.

use crate::local::db::ChatDb;
use serde_json::{json, Value};
use std::sync::Arc;
use super::models::{chat_model, channel_model, local_app, peer_model};
use super::parse::has_field;

/// Try to handle `op` as a query. Returns `Some(Value)` on match, `None` if
/// this operation is not a known query (caller should try mutations next).
pub fn handle(
    op: &str,
    query: &str,
    variables: &Value,
    db: &Arc<ChatDb>,
    token: &str,
    port: u16,
    https_port: u16,
    device_name: &str,
) -> Option<Value> {
    if op == "homeStats" {
        return Some(json!({
            "smsCount": 0, "contactCount": 0, "callCount": 0,
            "imageCount": 0, "audioCount": 0, "videoCount": 0,
            "packageCount": 0, "noteCount": 0, "docCount": 0,
            "feedEntryCount": 0, "mounts": []
        }));
    }
    if has_field(query, "app") {
        return Some(json!({ "app": local_app(token, port, https_port, device_name) }));
    }
    if op == "chatItems" || has_field(query, "chatItems") {
        let id = variables.get("id").and_then(Value::as_str).unwrap_or("local");
        let items = db.get_chats(id);
        return Some(json!({ "chatItems": items.iter().map(chat_model).collect::<Vec<_>>() }));
    }
    if op == "peers" || has_field(query, "peers") {
        let peers = db.get_peers();
        return Some(json!({ "peers": peers.iter().map(peer_model).collect::<Vec<_>>() }));
    }
    if op == "chatChannels" || has_field(query, "chatChannels") {
        let channels = db.get_channels();
        return Some(json!({ "chatChannels": channels.iter().map(channel_model).collect::<Vec<_>>() }));
    }
    None
}
