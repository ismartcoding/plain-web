//! Wire constants for `channelSystemMessage` GraphQL payloads.
//!
//! Mirrors plain-app `ChannelSystemMessages` (see
//! `plain-app/.../channel/ChannelSystemMessage.kt`). The peer uses
//! these `type` strings as a discriminator so the receiver can route
//! the JSON payload to the correct handler.

#![allow(dead_code)]

pub const TYPE_INVITE: &str = "channel_invite";
pub const TYPE_INVITE_ACCEPT: &str = "channel_invite_accept";
pub const TYPE_INVITE_DECLINE: &str = "channel_invite_decline";
pub const TYPE_UPDATE: &str = "channel_update";
pub const TYPE_KICK: &str = "channel_kick";
pub const TYPE_LEAVE: &str = "channel_leave";

// Member membership status (per-member; lives inside the `members` JSON array).
pub const MEMBER_STATUS_JOINED: &str = "joined";
pub const MEMBER_STATUS_PENDING: &str = "pending";

// Channel-level status (the channel's own `status` column).
pub const CHANNEL_STATUS_JOINED: &str = "joined";
pub const CHANNEL_STATUS_LEFT: &str = "left";
pub const CHANNEL_STATUS_KICKED: &str = "kicked";

// Peer status used when auto-creating peer records from channel metadata.
pub const PEER_STATUS_CHANNEL: &str = "channel";

/// Helper: format a `Vec<{id, status}>` JSON value back to the storage string.
pub fn encode_members(members: &[serde_json::Value]) -> String {
    serde_json::to_string(members).unwrap_or_else(|_| "[]".to_string())
}

/// Helper: parse the `members` storage string into a JSON array.
pub fn decode_members(raw: &str) -> Vec<serde_json::Value> {
    serde_json::from_str(raw).unwrap_or_default()
}

/// Helper: does the members list already contain `peer_id`?
pub fn has_member(members: &[serde_json::Value], peer_id: &str) -> bool {
    members.iter().any(|m| m["id"].as_str() == Some(peer_id))
}

/// Helper: find a member entry by peer id.
pub fn find_member<'a>(
    members: &'a [serde_json::Value],
    peer_id: &str,
) -> Option<&'a serde_json::Value> {
    members.iter().find(|m| m["id"].as_str() == Some(peer_id))
}
