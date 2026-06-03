//! Peer authentication for `/peer_graphql` requests.
//!
//! Encapsulates the trust chain that gates every incoming peer message:
//!   1. Look up the peer by the `c-id` header.
//!   2. Confirm the peer has been paired (status == "paired").
//!   3. Decrypt the body with the peer's shared XChaCha20 key.
//!   4. Verify the request timestamp is within the freshness window.
//!   5. Verify the Ed25519 signature over `{timestamp}{graphql_json}`.
//!
//! Each step produces a structured error that the caller maps to an HTTP
//! response, keeping this module free of any I/O concerns.

use std::time::{SystemTime, UNIX_EPOCH};

use crate::crypto::{base64_decode, ed25519_verify, xchacha_decrypt_raw};
use crate::local::db::{ChatDb, DPeer};

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
        }
    }
}

/// Run the full auth chain for an incoming peer request.
///
/// `header_client_id` is the peer id from the `c-id` header; `body` is the
/// raw (encrypted) request body.
pub fn authenticate(
    db: &ChatDb,
    header_client_id: &str,
    body: &[u8],
) -> Result<AuthenticatedPeer, AuthError> {
    let peer = db
        .get_peer_by_id(header_client_id)
        .ok_or(AuthError::UnknownPeer)?;
    if !peer.is_paired() {
        return Err(AuthError::NotPaired);
    }

    let key = base64_decode(&peer.key);
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
