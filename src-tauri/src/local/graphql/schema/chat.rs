use async_graphql::{Context, Object};
use serde_json::{json, Value};
use std::sync::Arc;

use super::super::context::{
    AppCtx, WsEvent, WS_CHANNELS_UPDATED, WS_MESSAGE_CREATED, WS_MESSAGE_DELETED,
    WS_MESSAGE_UPDATED,
};
use super::super::peer::{deliver_to_peer, peer_graphql_urls};
use super::types::{ChatChannel, ChatItem, Peer};
use crate::crypto::base64_decode;
use crate::local::db::{now_iso, DChannel, DChat};

fn chat_to_json(c: &DChat) -> Value {
    json!({
        "id": c.id, "fromId": c.from_id, "toId": c.to_id,
        "channelId": c.channel_id, "content": c.content,
        "createdAt": c.created_at, "updatedAt": c.updated_at,
        "status": c.status, "statusData": c.status_data, "data": null,
    })
}

#[derive(Default)]
pub struct ChatQuery;

#[Object]
impl ChatQuery {
    async fn chat_items(&self, ctx: &Context<'_>, id: String) -> Vec<ChatItem> {
        let c = ctx.data_unchecked::<Arc<AppCtx>>();
        c.db.get_chats(&id)
            .into_iter()
            .map(ChatItem::from)
            .collect()
    }

    async fn peers(&self, ctx: &Context<'_>) -> Vec<Peer> {
        let c = ctx.data_unchecked::<Arc<AppCtx>>();
        c.db.get_peers().into_iter().map(Peer::from).collect()
    }

    async fn chat_channels(&self, ctx: &Context<'_>) -> Vec<ChatChannel> {
        let c = ctx.data_unchecked::<Arc<AppCtx>>();
        c.db.get_channels()
            .into_iter()
            .map(ChatChannel::from)
            .collect()
    }

    async fn latest_chat_items(&self, _ctx: &Context<'_>) -> Vec<ChatItem> {
        vec![]
    }
}

#[derive(Default)]
pub struct ChatMutation;

#[Object]
impl ChatMutation {
    async fn send_chat_item(&self, ctx: &Context<'_>, to_id: String, content: String) -> ChatItem {
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

        let pending = is_peer && !peer_id.is_empty() && peer_id != "local";
        let mut chat = DChat::new("me", &to, &channel_id, &content);
        if pending {
            chat.status = "pending".to_string();
        }
        c.db.insert_chat(&chat);

        if pending {
            if let Some(peer) = c.db.get_peer_by_id(&peer_id) {
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
                if let Some(key) = key {
                    let chat_id = chat.id.clone();
                    let peer_urls = peer_graphql_urls(&peer);
                    let client_id = c.identity.client_id.clone();
                    let kp_bytes = base64_decode(&c.identity.ed25519_keypair);
                    let content_str = content.clone();
                    let event_tx = c.event_tx.clone();
                    let db = c.db.clone();
                    tokio::spawn(async move {
                        let ok = deliver_to_peer(
                            &peer_urls,
                            &key,
                            &client_id,
                            &kp_bytes,
                            &content_str,
                            None,
                        )
                        .await;
                        let new_status = if ok { "sent" } else { "failed" };
                        if let Some(updated) = db.update_chat_status(&chat_id, new_status) {
                            let _ = event_tx.send(WsEvent {
                                event_type: WS_MESSAGE_UPDATED,
                                payload: json!([chat_to_json(&updated)]).to_string(),
                            });
                        }
                    });
                }
            }
        }

        let _ = c.event_tx.send(WsEvent {
            event_type: WS_MESSAGE_CREATED,
            payload: json!([chat_to_json(&chat)]).to_string(),
        });
        ChatItem::from(chat)
    }

    async fn create_chat_item(
        &self,
        ctx: &Context<'_>,
        content: String,
        from_id: Option<String>,
        channel_id: Option<String>,
    ) -> ChatItem {
        let c = ctx.data_unchecked::<Arc<AppCtx>>();
        let from = from_id.as_deref().unwrap_or("");
        let ch_id = channel_id.as_deref().unwrap_or("");
        let to_id = if ch_id.is_empty() { "me" } else { "" };
        let chat = DChat::new(from, to_id, ch_id, &content);
        c.db.insert_chat(&chat);
        let _ = c.event_tx.send(WsEvent {
            event_type: WS_MESSAGE_CREATED,
            payload: json!([chat_to_json(&chat)]).to_string(),
        });
        ChatItem::from(chat)
    }

    async fn delete_chat_item(&self, ctx: &Context<'_>, id: String) -> bool {
        let c = ctx.data_unchecked::<Arc<AppCtx>>();
        c.db.delete_chat(&id);
        let _ = c.event_tx.send(WsEvent {
            event_type: WS_MESSAGE_DELETED,
            payload: json!([id]).to_string(),
        });
        true
    }

    async fn retry_chat_item(&self, ctx: &Context<'_>, id: String) -> Option<ChatItem> {
        let c = ctx.data_unchecked::<Arc<AppCtx>>();
        let updated = c.db.update_chat_status(&id, "sent");
        if let Some(ref chat) = updated {
            let _ = c.event_tx.send(WsEvent {
                event_type: WS_MESSAGE_UPDATED,
                payload: json!([chat_to_json(chat)]).to_string(),
            });
        }
        updated.map(ChatItem::from)
    }

    async fn create_chat_channel(&self, ctx: &Context<'_>, name: String) -> ChatChannel {
        let c = ctx.data_unchecked::<Arc<AppCtx>>();
        let ch = DChannel::new(name.trim());
        c.db.insert_channel(&ch);
        let channel = ChatChannel::from(ch);
        let _ = c.event_tx.send(WsEvent {
            event_type: WS_CHANNELS_UPDATED,
            payload: "{}".to_string(),
        });
        channel
    }

    async fn update_chat_channel(
        &self,
        ctx: &Context<'_>,
        id: String,
        name: String,
    ) -> Option<ChatChannel> {
        let c = ctx.data_unchecked::<Arc<AppCtx>>();
        let result = c.db.get_channel_by_id(&id).map(|mut ch| {
            ch.name = name.trim().to_string();
            ch.version += 1;
            ch.updated_at = now_iso();
            c.db.update_channel(&ch);
            ChatChannel::from(ch)
        });
        if result.is_some() {
            let _ = c.event_tx.send(WsEvent {
                event_type: WS_CHANNELS_UPDATED,
                payload: "{}".to_string(),
            });
        }
        result
    }

    async fn delete_chat_channel(&self, ctx: &Context<'_>, id: String) -> bool {
        let c = ctx.data_unchecked::<Arc<AppCtx>>();
        c.db.delete_chats_by_channel(&id);
        c.db.delete_channel(&id);
        let _ = c.event_tx.send(WsEvent {
            event_type: WS_CHANNELS_UPDATED,
            payload: "{}".to_string(),
        });
        true
    }

    async fn leave_chat_channel(&self, ctx: &Context<'_>, id: String) -> bool {
        let c = ctx.data_unchecked::<Arc<AppCtx>>();
        if let Some(mut ch) = c.db.get_channel_by_id(&id) {
            ch.status = "left".to_string();
            ch.updated_at = now_iso();
            c.db.update_channel(&ch);
            let _ = c.event_tx.send(WsEvent {
                event_type: WS_CHANNELS_UPDATED,
                payload: "{}".to_string(),
            });
        }
        true
    }

    async fn accept_chat_channel_invite(&self, _ctx: &Context<'_>, _id: String) -> bool {
        true
    }
    async fn decline_chat_channel_invite(&self, _ctx: &Context<'_>, _id: String) -> bool {
        true
    }
}
