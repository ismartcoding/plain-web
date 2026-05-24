//! Chat channel mutation handlers.

use crate::local::db::{now_iso, ChatDb, DChannel};
use serde_json::{json, Value};
use tokio::sync::broadcast;
use super::context::{WsEvent, WS_CHANNELS_UPDATED};
use super::models::channel_model;

pub fn create_chat_channel(
    db: &ChatDb,
    variables: &Value,
    event_tx: &broadcast::Sender<WsEvent>,
) -> Value {
    let name = variables.get("name").and_then(Value::as_str).unwrap_or_default().trim();
    let channel = DChannel::new(name);
    db.insert_channel(&channel);
    let model = channel_model(&channel);
    let _ = event_tx.send(WsEvent { event_type: WS_CHANNELS_UPDATED, payload: "{}".to_string() });
    json!({ "createChatChannel": model })
}

pub fn update_chat_channel(
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
        let _ = event_tx.send(WsEvent { event_type: WS_CHANNELS_UPDATED, payload: "{}".to_string() });
    }
    json!({ "updateChatChannel": result })
}

pub fn delete_chat_channel(
    db: &ChatDb,
    variables: &Value,
    event_tx: &broadcast::Sender<WsEvent>,
) -> Value {
    let id = variables.get("id").and_then(Value::as_str).unwrap_or_default();
    db.delete_chats_by_channel(id);
    db.delete_channel(id);
    let _ = event_tx.send(WsEvent { event_type: WS_CHANNELS_UPDATED, payload: "{}".to_string() });
    json!({ "deleteChatChannel": true })
}

pub fn leave_chat_channel(
    db: &ChatDb,
    variables: &Value,
    event_tx: &broadcast::Sender<WsEvent>,
) -> Value {
    let id = variables.get("id").and_then(Value::as_str).unwrap_or_default();
    if let Some(mut ch) = db.get_channel_by_id(id) {
        ch.status = "left".to_string();
        ch.updated_at = now_iso();
        db.update_channel(&ch);
        let _ = event_tx.send(WsEvent { event_type: WS_CHANNELS_UPDATED, payload: "{}".to_string() });
    }
    json!({ "leaveChatChannel": true })
}
