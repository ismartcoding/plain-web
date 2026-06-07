use async_graphql::{Context, Object};
use serde_json::{json, Value};
use std::sync::Arc;

use super::super::context::{
    AppCtx, WsEvent, WS_FETCH_LINK_PREVIEWS, WS_MESSAGE_CREATED, WS_MESSAGE_DELETED,
    WS_MESSAGE_UPDATED,
};
use super::super::peer::{deliver_to_peer, peer_graphql_urls};
use super::types::ChatItem;
use crate::crypto::base64_decode;
use crate::local::db::DChat;
use crate::local::channel::chat_helper::{
    build_no_leader_status_data, build_status_data_json, compute_status, send_async,
    ChannelDeliveryResult,
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
fn chat_to_json(c: &DChat, token: &str) -> Value {
    let data = chat_item_data_from_content(&c.content, token)
        .as_ref()
        .map(|d| match d {
            super::types::ChatItemData::MessageImages(m) => {
                json!({ "MessageImages": { "ids": &m.ids } })
            }
            super::types::ChatItemData::MessageFiles(m) => {
                json!({ "MessageFiles": { "ids": &m.ids } })
            }
            super::types::ChatItemData::MessageText(m) => {
                json!({ "MessageText": { "ids": &m.ids } })
            }
        });
    json!({
        "id": c.id, "fromId": c.from_id, "toId": c.to_id,
        "channelId": c.channel_id, "content": c.content,
        "createdAt": c.created_at, "updatedAt": c.updated_at,
        "status": c.status, "statusData": c.status_data, "data": data,
    })
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

fn is_text_content(content: &str) -> bool {
    serde_json::from_str::<Value>(content)
        .ok()
        .and_then(|v| v.get("type").and_then(|t| t.as_str()).map(|s| s.to_string()))
        .map(|t| t == "text")
        .unwrap_or(false)
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
                    let token = c.token.clone();
                    let peer_id_for_status = peer.id.clone();
                    let peer_name_for_status = peer.name.clone();
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
                        let (new_status, status_data) = match delivery_result {
                            Ok(()) => ("sent", String::new()),
                            Err(error) => (
                                "failed",
                                peer_delivery_status_data(
                                    &peer_id_for_status,
                                    &peer_name_for_status,
                                    &error,
                                ),
                            ),
                        };
                        if let Some(updated) =
                            db.update_chat_status_and_data(&chat_id, new_status, &status_data)
                        {
                            let _ = event_tx.send(WsEvent {
                                event_type: WS_MESSAGE_UPDATED,
                                payload: json!([chat_to_json(&updated, &token)]).to_string(),
                            });
                        }
                    });
                }
            }
        } else if is_channel {
            // Channel route: star topology, leader election.
            let channel = c.db.get_channel_by_id(&channel_id);
            if let Some(channel) = channel {
                let client_id = c.identity.client_id.clone();
                let kp_bytes = base64_decode(&c.identity.ed25519_keypair);

                // Peers that are joined but not me — match Kotlin's
                // `ChannelChatHelper.sendAsync` precheck.
                let member_ids = channel.joined_member_ids();
                let has_targets = member_ids.iter().any(|id| id != &client_id);

                if !has_targets {
                    chat.status = "sent".to_string();
                    if let Some(updated) = c.db.update_chat_status(&chat.id, "sent") {
                        chat = updated;
                    }
                } else {
                    let leader_opt = crate::local::channel::chat_helper::elect_leader(
                        &channel,
                        &c.peer_status,
                        &client_id,
                    );
                    let other_online = leader_opt.is_some()
                        || member_ids.iter().any(|id| {
                            id != &client_id && c.peer_status.is_online(id)
                        });

                    if !other_online {
                        // No leader / no online peers → "failed" with
                        // `DMessageStatusData(results=null)`.
                        chat.status = "failed".to_string();
                        let no_leader_data = build_no_leader_status_data();
                        if let Some(updated) = c.db.update_chat_status_and_data(
                            &chat.id,
                            "failed",
                            &no_leader_data,
                        ) {
                            chat = updated;
                        }
                    } else {
                        chat.status = "pending".to_string();
                        if let Some(updated) = c.db.update_chat_status(&chat.id, "pending") {
                            chat = updated;
                        }

                        let chat_id = chat.id.clone();
                        let content_str = content.clone();
                        let db = c.db.clone();
                        let event_tx = c.event_tx.clone();
                        let token = c.token.clone();
                        let peer_key_cache = c.peer_key_cache.clone();
                        let channel_key_cache = c.channel_key_cache.clone();
                        let peer_status = c.peer_status.clone();
                        let channel_for_send = channel.clone();

                        tokio::spawn(async move {
                            let result = send_async(
                                &channel_for_send,
                                &client_id,
                                &chat_id,
                                &content_str,
                                &db,
                                &peer_status,
                                &peer_key_cache,
                                &channel_key_cache,
                                &kp_bytes,
                            )
                            .await;
                            let (status, status_data) = match result {
                                Some(results) => {
                                    let s = compute_status(&results).to_string();
                                    let d = build_status_data_json(&results);
                                    (s, d)
                                }
                                None => {
                                    let s = "failed".to_string();
                                    let d = build_no_leader_status_data();
                                    (s, d)
                                }
                            };
                            if let Some(updated) = db
                                .update_chat_status_and_data(&chat_id, &status, &status_data)
                            {
                                let _ = event_tx.send(WsEvent {
                                    event_type: WS_MESSAGE_UPDATED,
                                    payload: json!([chat_to_json(&updated, &token)]).to_string(),
                                });
                            }
                        });
                    }
                }
            }
        }

        // Link preview: Kotlin fires `FetchLinkPreviewsEvent` when the
        // message is text. We emit a WS event the web client can listen
        // for to trigger its own preview fetcher. The event carries
        // the chat id so the frontend can correlate.
        if is_text_content(&content) && (!chat.to_id.is_empty() || !chat.channel_id.is_empty()) {
            let _ = c.event_tx.send(WsEvent {
                event_type: WS_FETCH_LINK_PREVIEWS,
                payload: json!({ "chatId": chat.id }).to_string(),
            });
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

    /// Retry a failed chat item. Mirrors Kotlin's
    /// `ChatDbHelper.retryAsync` — peer messages go back to
    /// `pending` and re-attempt delivery; channel messages flip back
    /// to `sent` if the per-member delivery already partially
    /// succeeded.
    async fn retry_chat_item(&self, ctx: &Context<'_>, id: String) -> Option<ChatItem> {
        let c = ctx.data_unchecked::<Arc<AppCtx>>().clone();
        let chat = c.db.get_chat_by_id(&id)?;
        let is_peer = !chat.to_id.is_empty() && chat.channel_id.is_empty();

        if !is_peer {
            let updated = c.db.update_chat_status(&id, "sent");
            if let Some(ref u) = updated {
                let _ = c.event_tx.send(WsEvent {
                    event_type: WS_MESSAGE_UPDATED,
                    payload: json!([chat_to_json(u, &c.token)]).to_string(),
                });
            }
            return updated.map(|u| ChatItem::with_data(u, &c.token));
        }

        let _ = c.db.update_chat_status(&id, "pending");
        let _ = c.event_tx.send(WsEvent {
            event_type: WS_MESSAGE_UPDATED,
            payload: json!([chat_to_json(&chat, &c.token)]).to_string(),
        });

        let peer_id = chat.to_id.clone();
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
                let chat_id = id.clone();
                let peer_urls = peer_graphql_urls(&peer);
                let client_id = c.identity.client_id.clone();
                let kp_bytes = base64_decode(&c.identity.ed25519_keypair);
                let content_str = chat.content.clone();
                let event_tx = c.event_tx.clone();
                let db = c.db.clone();
                let token = c.token.clone();
                let peer_id_for_status = peer.id.clone();
                let peer_name_for_status = peer.name.clone();
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
                    let (new_status, status_data) = match delivery_result {
                        Ok(()) => ("sent", String::new()),
                        Err(error) => (
                            "failed",
                            peer_delivery_status_data(
                                &peer_id_for_status,
                                &peer_name_for_status,
                                &error,
                            ),
                        ),
                    };
                    if let Some(updated) =
                        db.update_chat_status_and_data(&chat_id, new_status, &status_data)
                    {
                        let _ = event_tx.send(WsEvent {
                            event_type: WS_MESSAGE_UPDATED,
                            payload: json!([chat_to_json(&updated, &token)]).to_string(),
                        });
                    }
                });
            }
        }

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
