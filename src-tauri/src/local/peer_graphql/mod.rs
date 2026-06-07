//! Peer-to-peer GraphQL endpoint (`POST /peer_graphql`).
//!
//! Mirrors the structure of `crate::local::graphql` so the local and
//! peer-facing surfaces stay symmetrical, while keeping the two concerns
//! physically separated to avoid over-coupling the HTTP layer.
//!
//! Sub-modules:
//!   auth     — peer trust chain (decrypt, signature, timestamp)
//!   context  — per-request `PeerCtx` injected into the schema
//!   handlers — incoming-side mutation bodies (chat item, channel msg)
//!   schema   — async-graphql `PeerSchema` with the two peer mutations
//!
//! The HTTP request body and response are both ChaCha20-Poly1305 encrypted
//! using the peer's shared XChaCha20 key; the plaintext carries a
//! `signature|timestamp|GraphQL envelope`.

mod auth;
mod context;
mod handlers;
mod schema;

use std::sync::Arc;
use tokio::io::AsyncWrite;

use crate::crypto::xchacha_encrypt_raw;
use crate::local::graphql::context::AppCtx;
use crate::local::server::response::respond;

pub use auth::authenticate;
pub use context::PeerCtx;
pub use schema::{build_schema, PeerSchema};

/// Handle a fully-parsed `POST /peer_graphql` request.
///
/// The caller is responsible for HTTP framing (parsing the request line,
/// headers, and body). This function takes the encrypted body and the
/// `c-id` / `c-cid` headers, runs the auth chain, executes the GraphQL
/// payload through the typed peer schema, and writes the encrypted
/// response back to `wr`.
pub async fn handle<W>(
    wr: &mut W,
    body: &[u8],
    header_client_id: &str,
    header_channel_id: &str,
    ctx: &Arc<AppCtx>,
    peer_schema: &Arc<PeerSchema>,
) where
    W: AsyncWrite + Unpin,
{
    log::info!("[/peer_graphql] request from c-id={header_client_id}");

    // ── 1. Authenticate ──────────────────────────────────────────────────
    let authed = match authenticate(
        &ctx.db,
        header_client_id,
        header_channel_id,
        body,
        &ctx.channel_key_cache,
    ) {
        Ok(a) => a,
        Err(e) => {
            log::warn!("[/peer_graphql] auth failed: {}", e.reason());
            let msg = e.reason();
            respond(wr, 401, "Unauthorized", msg.as_bytes(), "text/plain").await;
            return;
        }
    };

    // ── 2. Execute through the typed schema ──────────────────────────────
    // The schema picks the right mutation by operation name and parses
    // its variables into the declared Rust types. The authenticated peer
    // (and the rest of the per-request state) is injected as `PeerCtx`;
    // the shared `Arc<AppCtx>` is reused so we never re-allocate it per
    // request.
    let peer_ctx = PeerCtx {
        peer: authed.peer,
        channel_id: header_channel_id.to_string(),
        client_id: ctx.identity.client_id.clone(),
        app: ctx.clone(),
    };
    let response = peer_schema
        .execute(
            async_graphql::Request::new(&authed.graphql_json).data(peer_ctx),
        )
        .await;
    let response_json = serde_json::to_value(&response)
        .unwrap_or_else(|_| serde_json::json!({ "data": null }));

    // ── 3. Encrypt and respond ───────────────────────────────────────────
    let response_text = response_json.to_string();
    match xchacha_encrypt_raw(&authed.key, response_text.as_bytes()) {
        Some(encrypted) => {
            respond(wr, 200, "OK", &encrypted, "application/octet-stream").await;
        }
        None => {
            respond(wr, 500, "Internal Server Error", b"", "text/plain").await;
        }
    }
}
