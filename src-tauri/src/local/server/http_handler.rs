use serde_json::{json, Value};
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncRead, AsyncReadExt, AsyncWrite};

use super::super::graphql::{create_chat_item_from_peer, execute_graphql, AppCtx, LocalSchema};
use super::file_server::serve_file;
use super::response::{respond, APP_ID};
use crate::crypto::{
    base64_decode, xchacha_decrypt_raw, xchacha_encrypt_raw, ed25519_verify, xchacha_decrypt,
    xchacha_encrypt,
};

pub(super) async fn handle<R, W>(
    rd: R,
    mut wr: W,
    schema: &Arc<LocalSchema>,
    ctx: &Arc<AppCtx>,
    data_dir: &std::path::Path,
) where
    R: AsyncRead + Unpin,
    W: AsyncWrite + Unpin,
{
    let mut reader = tokio::io::BufReader::new(rd);

    let mut req_line = String::new();
    if reader.read_line(&mut req_line).await.is_err() {
        return;
    }
    let parts: Vec<&str> = req_line
        .trim_end_matches(['\r', '\n'])
        .splitn(3, ' ')
        .collect();
    if parts.len() < 2 {
        return;
    }
    let method = parts[0].to_owned();
    let raw_path = parts[1].to_owned();
    let (path, query_str) = raw_path
        .split_once('?')
        .map(|(p, q)| (p.to_owned(), q.to_owned()))
        .unwrap_or_else(|| (raw_path.clone(), String::new()));

    let mut content_length = 0usize;
    let mut header_client_id = String::new();
    let mut header_channel_id = String::new();
    loop {
        let mut line = String::new();
        if reader.read_line(&mut line).await.is_err() {
            return;
        }
        let line = line.trim_end_matches(['\r', '\n']);
        if line.is_empty() {
            break;
        }
        if let Some((k, v)) = line.split_once(':') {
            let k = k.trim();
            let v = v.trim();
            if k.eq_ignore_ascii_case("content-length") {
                content_length = v.parse().unwrap_or(0);
            } else if k.eq_ignore_ascii_case("c-id") {
                header_client_id = v.to_string();
            } else if k.eq_ignore_ascii_case("c-cid") {
                header_channel_id = v.to_string();
            }
        }
    }

    if method == "OPTIONS" {
        respond(&mut wr, 200, "OK", b"", "text/plain").await;
        return;
    }

    let mut body = vec![0u8; content_length];
    if content_length > 0 && reader.read_exact(&mut body).await.is_err() {
        return;
    }

    match (method.as_str(), path.as_str()) {
        ("GET", "/health") => respond(&mut wr, 200, "OK", APP_ID.as_bytes(), "text/plain").await,
        ("POST", "/init") => respond(&mut wr, 200, "OK", b"", "text/plain").await,
        ("GET", "/fs") => {
            serve_file(&mut wr, &query_str, data_dir).await;
        }
        ("POST", "/graphql") => {
            let Some(plaintext) = xchacha_decrypt(&ctx.token, &body) else {
                respond(&mut wr, 401, "Unauthorized", b"", "text/plain").await;
                return;
            };
            let json_bytes = strip_replay_prefix(&plaintext);
            let request: Value = serde_json::from_slice(json_bytes).unwrap_or_else(|_| json!({}));
            let response_json = execute_graphql(schema, request, ctx.clone()).await;
            let response_text = response_json.to_string();
            match xchacha_encrypt(&ctx.token, response_text.as_bytes()) {
                Some(encrypted) => {
                    respond(&mut wr, 200, "OK", &encrypted, "application/octet-stream").await
                }
                None => respond(&mut wr, 500, "Internal Server Error", b"", "text/plain").await,
            }
        }
        ("POST", "/peer_graphql") => {
            // Authenticate incoming peer message:
            //   1. Look up peer by c-id header.
            //   2. Decrypt body with peer's shared key (ChaCha20Poly1305, 12B nonce).
            //   3. Verify Ed25519 signature: `{timestamp}{graphql_json}`.
            //   4. Check timestamp freshness (±5 min).
            let peer_opt = if header_client_id.is_empty() {
                None
            } else {
                ctx.db.get_peer_by_id(&header_client_id)
            };
            let Some(peer) = peer_opt else {
                respond(&mut wr, 401, "Unauthorized", b"unknown peer", "text/plain").await;
                return;
            };
            if !peer.is_paired() {
                respond(&mut wr, 401, "Unauthorized", b"not paired", "text/plain").await;
                return;
            };
            let key = base64_decode(&peer.key);
            let Some(plaintext_bytes) = xchacha_decrypt_raw(&key, &body) else {
                respond(
                    &mut wr,
                    401,
                    "Unauthorized",
                    b"decrypt failed",
                    "text/plain",
                )
                .await;
                return;
            };
            let plaintext = match std::str::from_utf8(&plaintext_bytes) {
                Ok(s) => s.to_string(),
                Err(_) => {
                    respond(&mut wr, 400, "Bad Request", b"", "text/plain").await;
                    return;
                }
            };
            // Format: `signature|timestamp|{graphql_json}`
            let mut parts = plaintext.splitn(3, '|');
            let sig_b64 = parts.next().unwrap_or_default();
            let ts_str = parts.next().unwrap_or_default();
            let gql_json = parts.next().unwrap_or_default();
            // Verify timestamp freshness (±5 min).
            use std::time::{SystemTime, UNIX_EPOCH};
            let ts: i64 = ts_str.parse().unwrap_or(0);
            let now_ms = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as i64;
            if (now_ms - ts).abs() > 5 * 60 * 1000 {
                respond(
                    &mut wr,
                    401,
                    "Unauthorized",
                    b"timestamp expired",
                    "text/plain",
                )
                .await;
                return;
            }
            // Verify Ed25519 signature over `{timestamp}{graphql_json}`.
            let sig_data = format!("{ts}{gql_json}");
            if !ed25519_verify(&peer.public_key, sig_data.as_bytes(), sig_b64) {
                respond(&mut wr, 401, "Unauthorized", b"bad signature", "text/plain").await;
                return;
            }
            // Parse content from GQL variables and dispatch directly (bypasses schema).
            let gql_req: Value = serde_json::from_str(gql_json).unwrap_or_else(|_| json!({}));
            let content = gql_req
                .get("variables")
                .and_then(|v| v.get("content"))
                .and_then(Value::as_str)
                .unwrap_or_default();
            let response_json = create_chat_item_from_peer(
                &ctx.db,
                &peer.id,
                &header_channel_id,
                content,
                &ctx.event_tx,
            );
            let response_text = response_json.to_string();
            match xchacha_encrypt_raw(&key, response_text.as_bytes()) {
                Some(encrypted) => {
                    respond(&mut wr, 200, "OK", &encrypted, "application/octet-stream").await;
                }
                None => {
                    respond(&mut wr, 500, "Internal Server Error", b"", "text/plain").await;
                }
            }
        }
        _ => respond(&mut wr, 404, "Not Found", b"", "text/plain").await,
    }
}

/// Strip the `"TIMESTAMP|NONCE|"` replay-protection prefix from the decrypted payload.
fn strip_replay_prefix(payload: &[u8]) -> &[u8] {
    let mut pipe_count = 0u8;
    for (i, &b) in payload.iter().enumerate() {
        if b == b'|' {
            pipe_count += 1;
            if pipe_count == 2 {
                return &payload[i + 1..];
            }
        }
    }
    payload
}
