//! Local channel system message API — mirrors plain-app's
//! `com.ismartcoding.plain.channel` package.
//!
//! `messages`   – wire type constants and small helpers
//! `handler`    – receiver-side handlers (called by `peer_graphql`)
//! `sender`     – sender-side helpers (called by GraphQL mutations)
//! `chat_helper` – star-topology leader election / broadcast helper

pub mod chat_helper;
pub mod handler;
pub mod messages;
pub mod sender;
