//! Local GraphQL server — entry point.
//!
//! Sub-modules:
//!   context  — WsEvent, PeerKeyCache, AppCtx
//!   executor — execute_graphql, stub pre-filter
//!   peer     — peer-to-peer send/receive over HTTPS
//!   schema   — async-graphql types, QueryRoot, MutationRoot

pub mod context;
pub mod executor;
pub mod peer;
pub mod schema;

pub use context::{
    AppCtx, WS_PEER_STATUS_UPDATED, WsEvent, encode_ws_event, new_peer_key_cache,
    refresh_peer_key_cache,
};
pub use executor::execute_graphql;
pub use peer::create_chat_item_from_peer;
pub use schema::{build_schema, LocalSchema};
