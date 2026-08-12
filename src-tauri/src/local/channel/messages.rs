//! Wire helpers for `channelSystemMessage` GraphQL payloads.
//!
//! Mirrors plain-app `ChannelSystemMessages` (see
//! `plain-app/.../channel/ChannelSystemMessage.kt`). The peer uses
//! these helpers to build the canonical signature payload and to
//! encode/decode the members JSON array.

use crate::local::enums::ChannelSystemMessageAction;

/// Build the canonical signature payload for a channel system message.
/// Mirrors plain-app `channelMessagePayload(channelId, version, action, target)`:
/// `"$channelId|$version|$action|$target"`.
///
/// `target` is the peer id being invited/kicked, or an empty string for
/// `update` and broadcast `kick`.
pub fn channel_message_payload(
    channel_id: &str,
    version: i64,
    action: ChannelSystemMessageAction,
    target: &str,
) -> String {
    format!("{channel_id}|{version}|{action}|{target}")
}

// ── Members helpers ──────────────────────────────────────────────────────

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
#[allow(dead_code)]
pub fn find_member<'a>(
    members: &'a [serde_json::Value],
    peer_id: &str,
) -> Option<&'a serde_json::Value> {
    members.iter().find(|m| m["id"].as_str() == Some(peer_id))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::{base64_encode, ed25519_generate, ed25519_sign, ed25519_verify};

    /// Verify the canonical payload format matches plain-app's
    /// `channelMessagePayload`: `"$channelId|$version|$action|$target"`.
    #[test]
    fn payload_format_matches_android() {
        assert_eq!(
            channel_message_payload("ch_abc", 3, ChannelSystemMessageAction::Invite, "peer_xyz"),
            "ch_abc|3|INVITE|peer_xyz"
        );
        assert_eq!(
            channel_message_payload("ch_abc", 5, ChannelSystemMessageAction::Update, ""),
            "ch_abc|5|UPDATE|"
        );
        assert_eq!(
            channel_message_payload("ch_abc", 9, ChannelSystemMessageAction::Kick, ""),
            "ch_abc|9|KICK|"
        );
    }

    /// Round-trip: sign an `invite` payload with the owner's keypair,
    /// then verify with the corresponding public key.
    #[test]
    fn signature_roundtrip_invite() {
        let (kp_bytes, vk_bytes) = ed25519_generate();
        let payload = channel_message_payload("ch_1", 1, ChannelSystemMessageAction::Invite, "peer_a");
        let sig = ed25519_sign(&kp_bytes, payload.as_bytes());
        assert!(!sig.is_empty(), "signature should not be empty");
        let pub_key_b64 = base64_encode(&vk_bytes);
        assert!(
            ed25519_verify(&pub_key_b64, payload.as_bytes(), &sig),
            "valid signature should verify"
        );
    }

    #[test]
    fn signature_roundtrip_update() {
        let (kp_bytes, vk_bytes) = ed25519_generate();
        let payload = channel_message_payload("ch_2", 7, ChannelSystemMessageAction::Update, "");
        let sig = ed25519_sign(&kp_bytes, payload.as_bytes());
        let pub_key_b64 = base64_encode(&vk_bytes);
        assert!(ed25519_verify(&pub_key_b64, payload.as_bytes(), &sig));
    }

    #[test]
    fn signature_roundtrip_kick() {
        let (kp_bytes, vk_bytes) = ed25519_generate();
        let payload = channel_message_payload("ch_3", 2, ChannelSystemMessageAction::Kick, "peer_b");
        let sig = ed25519_sign(&kp_bytes, payload.as_bytes());
        let pub_key_b64 = base64_encode(&vk_bytes);
        assert!(ed25519_verify(&pub_key_b64, payload.as_bytes(), &sig));
    }

    /// Tampering with the payload or signature must fail verification.
    #[test]
    fn signature_tamper_fails() {
        let (kp_bytes, vk_bytes) = ed25519_generate();
        let payload = channel_message_payload("ch_4", 1, ChannelSystemMessageAction::Invite, "peer_c");
        let sig = ed25519_sign(&kp_bytes, payload.as_bytes());
        let pub_key_b64 = base64_encode(&vk_bytes);

        // Tamper with version in the payload.
        let tampered = channel_message_payload("ch_4", 99, ChannelSystemMessageAction::Invite, "peer_c");
        assert!(
            !ed25519_verify(&pub_key_b64, tampered.as_bytes(), &sig),
            "tampered payload should fail verification"
        );

        // Tamper with the target peer id.
        let tampered_target = channel_message_payload("ch_4", 1, ChannelSystemMessageAction::Invite, "peer_evil");
        assert!(
            !ed25519_verify(&pub_key_b64, tampered_target.as_bytes(), &sig),
            "tampered target should fail verification"
        );

        // Garbage signature.
        let garbage_sig = base64_encode(&[0u8; 64]);
        assert!(
            !ed25519_verify(&pub_key_b64, payload.as_bytes(), &garbage_sig),
            "garbage signature should fail verification"
        );
    }
}
