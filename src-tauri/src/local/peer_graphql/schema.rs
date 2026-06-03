//! async-graphql schema for the peer endpoint.
//!
//! Defines a minimal, type-safe surface (a stub Query + the two mutations
//! the peer protocol actually uses) and builds it once at server start.
//! Per-request state is carried in `PeerCtx` (see `context.rs`); the
//! actual mutation bodies live in `handlers` (see `handlers.rs`).
//!
//! The Query root is required by the GraphQL spec; it intentionally
//! exposes no fields so peers can only invoke the two mutations.

use async_graphql::{Context, EmptySubscription, Object, Schema};

use super::context::PeerCtx;
use super::handlers::{channel_system_message_from_peer, create_chat_item_from_peer};
use crate::local::graphql::schema::types::ChatItem;

#[derive(Default)]
pub struct PeerQuery;

#[Object]
impl PeerQuery {
    /// Schema-mandated placeholder; the peer protocol is mutation-only.
    async fn _peer_schema_version(&self, _ctx: &Context<'_>) -> i32 {
        1
    }
}

#[derive(Default)]
pub struct PeerMutation;

#[Object]
impl PeerMutation {
    /// Receive a chat item from an authenticated peer.
    /// Wire format: `mutation CreateChatItem($content: String!) { createChatItem(content: $content) { ... } }`
    async fn create_chat_item(
        &self,
        ctx: &Context<'_>,
        content: String,
    ) -> ChatItem {
        let c = ctx.data_unchecked::<PeerCtx>();
        create_chat_item_from_peer(
            c.db(),
            &c.peer.id,
            &c.channel_id,
            &content,
            c.event_tx(),
        )
    }

    /// Receive a channel system message from an authenticated peer.
    /// Wire format: `mutation ChannelSystemMessage($type: String!, $payload: String!) { channelSystemMessage(type: $type, payload: $payload) }`
    async fn channel_system_message(
        &self,
        ctx: &Context<'_>,
        #[graphql(name = "type", desc = "System message type discriminator")] r#type: String,
        payload: String,
    ) -> bool {
        let c = ctx.data_unchecked::<PeerCtx>();
        channel_system_message_from_peer(
            c.db(),
            &c.client_id,
            &c.peer.id,
            &r#type,
            &payload,
            c.event_tx(),
        )
    }
}

pub type PeerSchema = Schema<PeerQuery, PeerMutation, EmptySubscription>;

pub fn build_schema() -> PeerSchema {
    Schema::build(PeerQuery::default(), PeerMutation::default(), EmptySubscription).finish()
}
