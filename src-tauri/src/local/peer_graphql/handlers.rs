//! Incoming-side handlers for the two peer GraphQL mutations.
//!
//! Called by the resolvers in [`super::schema`] *after* the request has
//! been authenticated and decrypted by [`super::auth`]. They are kept
//! here (rather than alongside the outgoing side in
//! `crate::local::graphql::peer`) so the entire peer endpoint's
//! data-plane lives in the `peer_graphql` module.

use crate::local::db::{ChatDb, DChat};
use crate::local::graphql::context::{
    WsEvent, WS_CHANNELS_UPDATED, WS_MESSAGE_CREATED,
};
use crate::local::graphql::schema::types::{chat_item_data_from_content, ChatItem};
use serde_json::{json, Value};
use tokio::sync::broadcast;

/// Persist an incoming chat item from a peer and broadcast the
/// `WS_MESSAGE_CREATED` event. Returns the typed `ChatItem` for the
/// GraphQL response.
pub fn create_chat_item_from_peer(
    db: &ChatDb,
    from_id: &str,
    channel_id: &str,
    content: &str,
    event_tx: &broadcast::Sender<WsEvent>,
    token: &str,
) -> ChatItem {
    // Channel membership gate (mirrors Kotlin's
    // `PeerGraphQL.createChatItem` IllegalStateException("Channel not joined")).
    if !channel_id.is_empty() {
        match db.get_channel_by_id(channel_id) {
            Some(ch) if ch.status == "joined" || ch.status == "kicked" => {}
            Some(_) => {
                log::warn!(
                    "[peer_graphql] dropping chat for channel {channel_id} in status {}",
                    db.get_channel_by_id(channel_id)
                        .map(|c| c.status)
                        .unwrap_or_default()
                );
                return ChatItem::from(DChat::new(from_id, "", channel_id, content));
            }
            None => {
                log::warn!("[peer_graphql] dropping chat for unknown channel {channel_id}");
                return ChatItem::from(DChat::new(from_id, "", channel_id, content));
            }
        }
    }
    let to_id = if channel_id.is_empty() { "me" } else { "" };
    let chat = DChat::new(from_id, to_id, channel_id, content);
    db.insert_chat(&chat);
    let item = ChatItem::with_data(chat.clone(), token);
    let _ = event_tx.send(WsEvent {
        event_type: WS_MESSAGE_CREATED,
        payload: json!([item_to_json(&chat, token)]).to_string(),
    });
    item
}

/// Dispatch an incoming `channelSystemMessage` to the local channel
/// handler and broadcast `WS_CHANNELS_UPDATED` so local UI can refresh.
///
/// Returns the boolean the peer expects from the GraphQL contract. The
/// underlying handler decides whether the dispatch is meaningful, and
/// any WS broadcast is fired inside the handler itself. As an
/// additional safety net we always fire `WS_CHANNELS_UPDATED` here to
/// match the original behaviour (recognised messages end up firing it
/// twice, which is harmless).
#[allow(clippy::too_many_arguments)]
pub fn channel_system_message_from_peer(
    db: &ChatDb,
    client_id: &str,
    device_name: &str,
    from_id: &str,
    msg_type: &str,
    payload: &str,
    event_tx: &broadcast::Sender<WsEvent>,
    peer_key_cache: &crate::local::graphql::context::PeerKeyCache,
    channel_key_cache: &crate::local::graphql::context::ChannelKeyCache,
    kp_bytes: &[u8],
) -> bool {
    let ok = crate::local::channel::handler::handle(
        db,
        client_id,
        device_name,
        from_id,
        msg_type,
        payload,
        event_tx,
        kp_bytes,
        peer_key_cache,
        channel_key_cache,
    );
    let _ = event_tx.send(WsEvent {
        event_type: WS_CHANNELS_UPDATED,
        payload: "{}".to_string(),
    });
    ok
}

/// Serialize a `DChat` into the camelCase wire format used by the
/// `WS_MESSAGE_CREATED` payload. Kept distinct from `ChatItem`'s
/// automatic serialisation so we don't have to plumb the `updated_at`
/// field (which `ChatItem` does not expose).
fn item_to_json(c: &DChat, token: &str) -> Value {
    let data = chat_item_data_from_content(&c.content, token)
        .as_ref()
        .map(|d| match d {
            crate::local::graphql::schema::types::ChatItemData::MessageImages(m) => {
                json!({ "__typename": "MessageImages", "ids": &m.ids })
            }
            crate::local::graphql::schema::types::ChatItemData::MessageFiles(m) => {
                json!({ "__typename": "MessageFiles", "ids": &m.ids })
            }
            crate::local::graphql::schema::types::ChatItemData::MessageText(m) => {
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
