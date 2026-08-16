//! Peer-status WebSocket handler (`/status`).
//!
//! Mirrors Android's `WebSocket.kt` `/status` handler:
//! 1. Require `cid` query param (peer ID).
//! 2. Expect the first Binary frame: ChaCha20-decrypt with peer shared key,
//!    then verify Ed25519 signature over `{timestamp}{cid}`.
//! 3. On success: mark peer online and reply `"ok"`.
//! 4. On disconnect: mark peer offline.

use futures_util::{SinkExt, StreamExt};
use std::sync::Arc;
use tokio_tungstenite::tungstenite::Message;

use super::super::super::graphql::AppCtx;
use plain_rs::{base64_decode, xchacha_decrypt_raw, ed25519_verify};

pub(super) async fn handle<S>(
    ws: tokio_tungstenite::WebSocketStream<S>,
    path: &str,
    ctx: &Arc<AppCtx>,
) where
    S: tokio::io::AsyncRead + tokio::io::AsyncWrite + Unpin,
{
    let Some(peer_id) = super::query_param(path, "cid").filter(|v| !v.is_empty()) else {
        log::debug!("local_server status_ws: `cid` is missing");
        return;
    };

    log::debug!("local_server status_ws: new connection peer_id={peer_id}");
    let (mut sink, mut stream) = ws.split();
    let mut authenticated = false;

    while let Some(message) = stream.next().await {
        match message {
            Ok(Message::Binary(bytes)) if !authenticated => {
                if authenticate_peer(&peer_id, bytes.as_ref(), ctx) {
                    authenticated = true;
                    ctx.peer_status.set_online(&peer_id, true);
                    if sink.send(Message::Text("ok".into())).await.is_err() {
                        break;
                    }
                } else {
                    log::debug!("local_server status_ws: auth failed peer_id={peer_id}");
                    let _ = sink.close().await;
                    break;
                }
            }
            Ok(Message::Close(_)) => break,
            Err(_) => break,
            _ => {}
        }
    }

    if authenticated {
        ctx.peer_status.disconnected(&peer_id);
    }
}

/// Verify the auth payload sent by the peer on connect.
///
/// Expected plaintext after ChaCha20 decryption: `{sig}|{timestamp_ms}|{cid}`
/// where `sig` is an Ed25519 signature over `{timestamp_ms}{cid}`.
fn authenticate_peer(peer_id: &str, payload: &[u8], ctx: &AppCtx) -> bool {
    log::debug!("status_ws auth: peer_id={peer_id} payload_len={}", payload.len());
    let Some(peer) = ctx.db.get_peer_by_id(peer_id) else {
        log::debug!("status_ws auth: peer not found peer_id={peer_id}");
        return false;
    };
    log::debug!(
        "status_ws auth: peer found is_paired={} key_len={} pubkey_len={}",
        peer.is_paired(),
        peer.key.len(),
        peer.public_key.len()
    );
    if !peer.is_paired() || peer.key.is_empty() || peer.public_key.is_empty() {
        log::debug!("status_ws auth: peer not ready peer_id={peer_id}");
        return false;
    }
    let key = base64_decode(&peer.key);
    log::debug!("status_ws auth: decoded key_len={}", key.len());
    if key.len() != 32 {
        log::debug!("status_ws auth: bad key length {} (expected 32)", key.len());
        return false;
    }
    let Some(plaintext) = xchacha_decrypt_raw(&key, payload) else {
        log::debug!("status_ws auth: xchacha decrypt failed peer_id={peer_id}");
        return false;
    };
    let Ok(text) = std::str::from_utf8(&plaintext) else {
        log::debug!("status_ws auth: plaintext is not valid utf8 peer_id={peer_id}");
        return false;
    };
    log::debug!("status_ws auth: plaintext={text:?}");
    let mut parts = text.splitn(3, '|');
    let signature = parts.next().unwrap_or_default();
    let timestamp = parts.next().unwrap_or_default();
    let client_id = parts.next().unwrap_or_default();
    log::debug!("status_ws auth: sig_len={} timestamp={timestamp} client_id={client_id}", signature.len());
    if client_id != peer_id {
        log::debug!("status_ws auth: client_id mismatch: got={client_id} expected={peer_id}");
        return false;
    }
    let Ok(timestamp_ms) = timestamp.parse::<i64>() else {
        log::debug!("status_ws auth: timestamp parse failed: {timestamp:?}");
        return false;
    };
    let diff = (now_ms() - timestamp_ms).abs();
    log::debug!("status_ws auth: timestamp_diff_ms={diff}");
    if diff > 5 * 60 * 1000 {
        log::debug!("status_ws auth: timestamp expired diff_ms={diff}");
        return false;
    }
    let sig_input = format!("{timestamp}{client_id}");
    let ok = ed25519_verify(&peer.public_key, sig_input.as_bytes(), signature);
    log::debug!("status_ws auth: ed25519_verify={ok} sig_input={sig_input:?}");
    ok
}

fn now_ms() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}
