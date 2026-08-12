//! Peer authentication for `/peer_graphql` requests.
//!
//! Encapsulates the trust chain that gates every incoming peer message:
//!   1. Look up the peer by the `c-id` header.
//!   2. Confirm the peer has been paired (status == "PAIRED").
//!   3. Pick the decryption key — if `c-cid` is set, use the
//!      per-channel key from `channel_key_cache[c-cid]`; otherwise use
//!      the peer's shared key. This mirrors Kotlin's
//!      `PeerGraphQL.install()`.
//!   4. Decrypt the body with the chosen XChaCha20 key.
//!   5. Verify the request timestamp is within the freshness window.
//!   6. Verify the Ed25519 signature over `{timestamp}{graphql_json}`.
//!
//! Each step produces a structured error that the caller maps to an HTTP
//! response, keeping this module free of any I/O concerns.

use std::time::{SystemTime, UNIX_EPOCH};

use crate::crypto::{base64_decode, ed25519_verify, xchacha_decrypt_raw};
use crate::local::db::{ChatDb, DPeer};
use crate::local::graphql::context::ChannelKeyCache;

/// Maximum allowed clock skew (forward or backward) for a peer request.
const TIMESTAMP_WINDOW_MS: i64 = 5 * 60 * 1000;

/// Outcome of the auth chain. On success, carries the peer's key and the
/// parsed plaintext payload (already split into `signature`, `timestamp`,
/// and the GraphQL JSON body).
#[allow(dead_code)] // `signature_b64` and `timestamp` are part of the public
                    // auth result surface; current callers only need the key
                    // and the GraphQL JSON, but downstream code may want
                    // them for audit logging.
pub struct AuthenticatedPeer {
    pub peer: DPeer,
    pub key: Vec<u8>,
    pub signature_b64: String,
    pub timestamp: i64,
    pub graphql_json: String,
}

/// Failure modes the caller may want to map to different HTTP responses.
pub enum AuthError {
    UnknownPeer,
    NotPaired,
    DecryptFailed,
    NotUtf8,
    TimestampExpired,
    BadSignature,
    MissingFields,
    #[allow(dead_code)] // kept for completeness; current path falls back to peer key
    NoChannelKey,
}

impl AuthError {
    /// Short, machine-readable reason string for logging / response bodies.
    pub fn reason(&self) -> &'static str {
        match self {
            AuthError::UnknownPeer => "unknown peer",
            AuthError::NotPaired => "not paired",
            AuthError::DecryptFailed => "decrypt failed",
            AuthError::NotUtf8 => "not utf-8",
            AuthError::TimestampExpired => "timestamp expired",
            AuthError::BadSignature => "bad signature",
            AuthError::MissingFields => "missing fields",
            AuthError::NoChannelKey => "no channel key",
        }
    }
}

/// Run the full auth chain for an incoming peer request.
///
/// `header_client_id` is the peer id from the `c-id` header;
/// `header_channel_id` is the channel id from the `c-cid` header
/// (used to look up a per-channel key when present);
/// `channel_key_cache` carries the local node's known per-channel
/// keys; `body` is the raw (encrypted) request body.
pub fn authenticate(
    db: &ChatDb,
    header_client_id: &str,
    header_channel_id: &str,
    body: &[u8],
    channel_key_cache: &ChannelKeyCache,
) -> Result<AuthenticatedPeer, AuthError> {
    let peer = db
        .get_peer_by_id(header_client_id)
        .ok_or(AuthError::UnknownPeer)?;
    if !peer.is_paired() {
        return Err(AuthError::NotPaired);
    }

    // Pick the decryption key: prefer the per-channel key when the
    // request carries a `c-cid` header and we know that key locally;
    // otherwise fall back to the peer's shared key. Mirrors
    // `PeerGraphQL.install()`'s `if (channelId != "") channelKeyCache
    // else peerKeyCache` branch.
    let key = if !header_channel_id.is_empty() {
        let cache = channel_key_cache.read().unwrap();
        match cache.get(header_channel_id).cloned() {
            Some(k) => k,
            None => {
                log::debug!(
                    "auth: no channel key for {header_channel_id}, falling back to peer key"
                );
                base64_decode(&peer.key)
            }
        }
    } else {
        base64_decode(&peer.key)
    };
    let plaintext_bytes = xchacha_decrypt_raw(&key, body).ok_or(AuthError::DecryptFailed)?;
    let plaintext = std::str::from_utf8(&plaintext_bytes)
        .map_err(|_| AuthError::NotUtf8)?
        .to_string();

    // Wire format: `signature|timestamp|{graphql_json}`
    let mut parts = plaintext.splitn(3, '|');
    let signature_b64 = parts.next().unwrap_or_default().to_string();
    let ts_str = parts.next().unwrap_or_default();
    let graphql_json = parts.next().unwrap_or_default().to_string();

    if signature_b64.is_empty() || graphql_json.is_empty() {
        return Err(AuthError::MissingFields);
    }

    let timestamp: i64 = ts_str.parse().unwrap_or(0);
    let now_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64;
    if (now_ms - timestamp).abs() > TIMESTAMP_WINDOW_MS {
        return Err(AuthError::TimestampExpired);
    }

    // Signature is computed over `{timestamp}{graphql_json}` (no separator),
    // matching the sender side in `graphql/peer.rs::deliver_to_peer`.
    let sig_data = format!("{timestamp}{graphql_json}");
    if !ed25519_verify(&peer.public_key, sig_data.as_bytes(), &signature_b64) {
        return Err(AuthError::BadSignature);
    }

    Ok(AuthenticatedPeer {
        peer,
        key,
        signature_b64,
        timestamp,
        graphql_json,
    })
}
