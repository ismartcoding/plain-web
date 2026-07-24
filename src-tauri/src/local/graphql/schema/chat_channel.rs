use async_graphql::{Context, Error as GqlError, Object, Result as GqlResult};
use std::sync::Arc;

use super::super::context::{refresh_peer_key_cache, AppCtx, WsEvent, WS_CHANNELS_UPDATED};
use super::types::ChatChannel;
use crate::crypto::base64_decode;
use crate::local::db::{now_iso, DChannel};

#[derive(Default)]
pub struct ChatChannelMutation;

fn gql_err(msg: impl Into<String>) -> GqlError {
    GqlError::new(msg.into())
}

fn emit_channels_updated(c: &AppCtx) {
    let _ = c.event_tx.send(WsEvent {
        event_type: WS_CHANNELS_UPDATED,
        payload: "{}".to_string(),
    });
}

#[Object]
impl ChatChannelMutation {
    async fn create_chat_channel(&self, ctx: &Context<'_>, name: String) -> ChatChannel {
        let c = ctx.data_unchecked::<Arc<AppCtx>>();
        let ch = DChannel::new(name.trim(), &c.identity.client_id);
        c.db.insert_channel(&ch);
        let channel = ChatChannel::from(ch);
        emit_channels_updated(c);
        channel
    }

    async fn update_chat_channel(
        &self,
        ctx: &Context<'_>,
        id: String,
        name: String,
    ) -> GqlResult<ChatChannel> {
        let c = ctx.data_unchecked::<Arc<AppCtx>>().clone();
        let mut ch = c
            .db
            .get_channel_by_id(&id)
            .ok_or_else(|| gql_err("Channel not found"))?;
        ch.name = name.trim().to_string();
        ch.version += 1;
        ch.updated_at = now_iso();
        c.db.update_channel(&ch);
        if ch.owner == c.identity.client_id {
            let kp_bytes = base64_decode(&c.identity.ed25519_keypair);
            let channel_key = base64_decode(&ch.key);
            crate::local::channel::sender::broadcast_update(
                &ch,
                &c.identity.client_id,
                &c.identity.device_name,
                &kp_bytes,
                &c.db,
                &c.peer_key_cache,
                &channel_key,
            )
            .await;
        }
        emit_channels_updated(&c);
        Ok(ChatChannel::from(ch))
    }

    async fn delete_chat_channel(&self, ctx: &Context<'_>, id: String) -> bool {
        let c = ctx.data_unchecked::<Arc<AppCtx>>().clone();
        if let Some(mut ch) = c.db.get_channel_by_id(&id) {
            if ch.owner == c.identity.client_id {
                let kp_bytes = base64_decode(&c.identity.ed25519_keypair);
                let channel_key = base64_decode(&ch.key);
                crate::local::channel::sender::broadcast_kick(
                    &ch,
                    &c.identity.client_id,
                    &kp_bytes,
                    &c.db,
                    &c.peer_key_cache,
                    &channel_key,
                )
                .await;
            }
            ch.status = "left".to_string();
            ch.updated_at = now_iso();
            c.db.update_channel(&ch);
        }
        c.db.delete_chats_by_channel(&id);
        c.db.delete_channel(&id);
        refresh_peer_key_cache(&c.db, &c.peer_key_cache);
        emit_channels_updated(&c);
        true
    }

    async fn leave_chat_channel(&self, ctx: &Context<'_>, id: String) -> bool {
        let c = ctx.data_unchecked::<Arc<AppCtx>>().clone();
        if let Some(mut ch) = c.db.get_channel_by_id(&id) {
            if ch.owner != c.identity.client_id {
                if let Some(owner_peer) = c.db.get_peer_by_id(&ch.owner) {
                    let kp_bytes = base64_decode(&c.identity.ed25519_keypair);
                    let channel_key = base64_decode(&ch.key);
                    let _ = crate::local::channel::sender::send_leave(
                        &ch.id,
                        &owner_peer,
                        &kp_bytes,
                        &channel_key,
                        &c.peer_key_cache,
                    )
                    .await;
                }
                let members: Vec<serde_json::Value> =
                    serde_json::from_str(&ch.members).unwrap_or_default();
                let new_members: Vec<serde_json::Value> = members
                    .into_iter()
                    .filter(|m| m["id"].as_str() != Some(c.identity.client_id.as_str()))
                    .collect();
                ch.members = serde_json::to_string(&new_members)
                    .unwrap_or_else(|_| "[]".to_string());
                ch.status = "left".to_string();
                ch.updated_at = now_iso();
                c.db.update_channel(&ch);
                refresh_peer_key_cache(&c.db, &c.peer_key_cache);
            }
            emit_channels_updated(&c);
        }
        true
    }

    async fn add_chat_channel_member(
        &self,
        ctx: &Context<'_>,
        id: String,
        peer_id: String,
    ) -> GqlResult<ChatChannel> {
        let c = ctx.data_unchecked::<Arc<AppCtx>>().clone();
        let mut ch = c
            .db
            .get_channel_by_id(&id)
            .ok_or_else(|| gql_err("Channel not found"))?;
        if ch.owner != c.identity.client_id {
            return Err(gql_err("Only owner can add members"));
        }
        let members: Vec<serde_json::Value> =
            serde_json::from_str(&ch.members).unwrap_or_default();
        if members.iter().any(|m| m["id"].as_str() == Some(&peer_id)) {
            return Err(gql_err("Already a member"));
        }
        let mut new_members = members;
        new_members.push(serde_json::json!({
            "id": peer_id,
            "status": "pending",
        }));
        ch.members = serde_json::to_string(&new_members).unwrap_or_else(|_| "[]".to_string());
        ch.version += 1;
        ch.updated_at = now_iso();
        c.db.update_channel(&ch);

        if let Some(peer) = c.db.get_peer_by_id(&peer_id) {
            let kp_bytes = base64_decode(&c.identity.ed25519_keypair);
            let channel_key = base64_decode(&ch.key);
            let _ = crate::local::channel::sender::send_invite(
                &ch,
                &peer,
                &c.identity.client_id,
                &c.identity.device_name,
                &kp_bytes,
                &c.db,
                &c.peer_key_cache,
                &channel_key,
            )
            .await;
        }
        emit_channels_updated(&c);
        Ok(ChatChannel::from(ch))
    }

    async fn remove_chat_channel_member(
        &self,
        ctx: &Context<'_>,
        id: String,
        peer_id: String,
    ) -> GqlResult<ChatChannel> {
        let c = ctx.data_unchecked::<Arc<AppCtx>>().clone();
        let mut ch = c
            .db
            .get_channel_by_id(&id)
            .ok_or_else(|| gql_err("Channel not found"))?;
        if ch.owner != c.identity.client_id {
            return Err(gql_err("Only owner can remove members"));
        }
        let members: Vec<serde_json::Value> =
            serde_json::from_str(&ch.members).unwrap_or_default();
        if !members.iter().any(|m| m["id"].as_str() == Some(&peer_id)) {
            return Err(gql_err("Not a member"));
        }
        let new_members: Vec<serde_json::Value> = members
            .into_iter()
            .filter(|m| m["id"].as_str() != Some(&peer_id))
            .collect();
        ch.members = serde_json::to_string(&new_members).unwrap_or_else(|_| "[]".to_string());
        ch.version += 1;
        ch.updated_at = now_iso();
        c.db.update_channel(&ch);

        let kp_bytes = base64_decode(&c.identity.ed25519_keypair);
        let channel_key = base64_decode(&ch.key);
        if let Some(peer) = c.db.get_peer_by_id(&peer_id) {
            let _ = crate::local::channel::sender::send_kick(
                &ch.id,
                ch.version,
                &peer,
                &kp_bytes,
                &channel_key,
                &c.peer_key_cache,
            )
            .await;
        }
        crate::local::channel::sender::broadcast_update(
            &ch,
            &c.identity.client_id,
            &c.identity.device_name,
            &kp_bytes,
            &c.db,
            &c.peer_key_cache,
            &channel_key,
        )
        .await;
        emit_channels_updated(&c);
        Ok(ChatChannel::from(ch))
    }

    async fn accept_chat_channel_invite(&self, ctx: &Context<'_>, id: String) -> GqlResult<bool> {
        let c = ctx.data_unchecked::<Arc<AppCtx>>().clone();
        let ch = c
            .db
            .get_channel_by_id(&id)
            .ok_or_else(|| gql_err("Channel not found"))?;
        let owner_peer = c
            .db
            .get_peer_by_id(&ch.owner)
            .ok_or_else(|| gql_err("Owner peer not found"))?;
        let kp_bytes = base64_decode(&c.identity.ed25519_keypair);
        let channel_key = base64_decode(&ch.key);
        let _ = crate::local::channel::sender::send_invite_accept(
            &ch.id,
            &owner_peer,
            &kp_bytes,
            &c.identity.device_name,
            "desktop",
            &channel_key,
            &c.peer_key_cache,
        )
        .await;
        Ok(true)
    }

    async fn decline_chat_channel_invite(&self, ctx: &Context<'_>, id: String) -> bool {
        let c = ctx.data_unchecked::<Arc<AppCtx>>().clone();
        let Some(ch) = c.db.get_channel_by_id(&id) else {
            return true;
        };
        if let Some(owner_peer) = c.db.get_peer_by_id(&ch.owner) {
            let kp_bytes = base64_decode(&c.identity.ed25519_keypair);
            let channel_key = base64_decode(&ch.key);
            let _ = crate::local::channel::sender::send_invite_decline(
                &ch.id,
                &owner_peer,
                &kp_bytes,
                &channel_key,
                &c.peer_key_cache,
            )
            .await;
        }
        c.db.delete_chats_by_channel(&ch.id);
        c.db.delete_channel(&ch.id);
        refresh_peer_key_cache(&c.db, &c.peer_key_cache);
        emit_channels_updated(&c);
        true
    }

    /// Web-only convenience mutation that branches to
    /// `acceptChatChannelInvite` or `declineChatChannelInvite` based
    /// on the `accept` flag. The plain-app Android schema doesn't
    /// expose this — the web client added it so the
    /// `ChannelInviteModal` can use a single GraphQL document for
    /// both buttons. Returns the `accept` flag verbatim so the
    /// modal's `onDone` handler can read the chosen action back from
    /// the mutation result.
    async fn respond_channel_invite(
        &self,
        ctx: &Context<'_>,
        id: String,
        accept: bool,
    ) -> bool {
        if accept {
            // Reuse the accept path — `accept_chat_channel_invite`
            // already returns `Ok(true)` on success.
            let _ = Self::accept_chat_channel_invite(self, ctx, id).await;
        } else {
            let _ = Self::decline_chat_channel_invite(self, ctx, id).await;
        }
        accept
    }

    async fn channel_system_message(
        &self,
        _ctx: &Context<'_>,
        #[graphql(name = "type")] _msg_type: String,
        _payload: String,
    ) -> bool {
        // Debug-only stub. The Kotlin client only invokes
        // `channelSystemMessage` through the peer endpoint
        // (`/peer_graphql`), which has its own resolver in
        // `peer_graphql::handlers::channel_system_message_from_peer`.
        // Exposing it on the main schema would double-process the
        // same wire payload, so we keep this here purely so the
        // GraphQL schema still validates; the implementation is a
        // no-op.
        log::warn!("[chat_channel] main-schema channelSystemMessage called — use /peer_graphql instead");
        false
    }
}
