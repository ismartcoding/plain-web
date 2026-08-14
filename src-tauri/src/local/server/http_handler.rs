use serde_json::{json, Value};
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncRead, AsyncReadExt, AsyncWrite};

use super::super::graphql::{execute_graphql, AppCtx, LocalSchema};
use super::super::peer_graphql::{self, PeerSchema};
use super::file_server::serve_file;
use super::proxy_file::proxy_file;
use super::response::{respond, APP_ID};
use super::upload;
use crate::crypto::{base64_decode, base64_encode, xchacha_decrypt, xchacha_encrypt};

pub(super) async fn handle<R, W>(
    rd: R,
    mut wr: W,
    schema: &Arc<LocalSchema>,
    peer_schema: &Arc<PeerSchema>,
    ctx: &Arc<AppCtx>,
    data_dir: &std::path::Path,
) where
    R: AsyncRead + Unpin,
    W: AsyncWrite + Unpin,
{
    let _ = data_dir; // /fs now uses ctx.data_dir via the file_server handler.
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

    let mut content_type = String::new();
    let mut content_length: usize = 0;
    let mut header_client_id = String::new();
    let mut header_channel_id = String::new();
    let mut header_range = String::new();
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
            if k.eq_ignore_ascii_case("content-type") {
                content_type = v.to_string();
            } else if k.eq_ignore_ascii_case("content-length") {
                content_length = v.parse().unwrap_or(0);
            } else if k.eq_ignore_ascii_case("c-id") {
                header_client_id = v.to_string();
            } else if k.eq_ignore_ascii_case("c-cid") {
                header_channel_id = v.to_string();
            } else if k.eq_ignore_ascii_case("range") {
                header_range = v.to_string();
            }
        }
    }

    if method == "OPTIONS" {
        respond(&mut wr, 200, "OK", b"", "text/plain").await;
        return;
    }

    match (method.as_str(), path.as_str()) {
        ("GET", "/health") => respond(&mut wr, 200, "OK", APP_ID.as_bytes(), "text/plain").await,
        ("POST", "/init") => {
            // Mirrors Kotlin SystemRoutes `/init`:
            //   1. If body encrypted with token → client is authenticated →
            //      return empty body (frontend: token + empty body → auto-login)
            //   2. Otherwise return InitResponse(signaturePublicKey) as JSON
            //      so the frontend can proceed with the handshake.
            //
            // The Tauri desktop app has no password management. The
            // signaturePublicKey is the Ed25519 verifying key (last 32
            // bytes of the 64-byte keypair).
            let mut authenticated = false;
            if content_length > 0 && !ctx.token.is_empty() {
                let mut body = vec![0u8; content_length];
                if reader.read_exact(&mut body).await.is_ok() {
                    authenticated = crate::crypto::xchacha_decrypt(&ctx.token, &body).is_some();
                }
            }

            if authenticated {
                // Frontend: `r.status === 200 && token && !bodyText` → finishLoginSuccess()
                respond(&mut wr, 200, "OK", b"", "text/plain").await;
            } else {
                let kp_bytes = base64_decode(&ctx.identity.ed25519_keypair);
                let signature_public_key = if kp_bytes.len() == 64 {
                    base64_encode(&kp_bytes[32..])
                } else {
                    String::new()
                };
                let json = json!({ "signaturePublicKey": signature_public_key });
                respond(&mut wr, 200, "OK", json.to_string().as_bytes(), "application/json").await;
            }
        }
        ("GET", "/fs") => {
            serve_file(&mut wr, &query_str, &header_range, ctx).await;
        }
        ("GET", "/proxyfs") => {
            proxy_file(&mut wr, &query_str, &header_range, ctx).await;
        }
        ("POST", "/upload") => {
            if header_client_id.is_empty() || header_client_id != ctx.identity.client_id {
                respond(&mut wr, 401, "Unauthorized", b"", "text/plain").await;
                return;
            }
            upload::handle_upload(reader, wr, ctx, &content_type, content_length).await;
        }
        ("POST", "/upload_chunk") => {
            if header_client_id.is_empty() || header_client_id != ctx.identity.client_id {
                respond(&mut wr, 401, "Unauthorized", b"", "text/plain").await;
                return;
            }
            upload::handle_upload_chunk(reader, wr, ctx, &content_type, content_length).await;
        }
        ("POST", "/graphql") => {
            let mut body = vec![0u8; content_length];
            if content_length > 0 && tokio::io::AsyncReadExt::read_exact(&mut reader, &mut body).await.is_err() {
                return;
            }
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
            let mut body = vec![0u8; content_length];
            if content_length > 0 && tokio::io::AsyncReadExt::read_exact(&mut reader, &mut body).await.is_err() {
                return;
            }
            peer_graphql::handle(
                &mut wr,
                &body,
                &header_client_id,
                &header_channel_id,
                ctx,
                peer_schema,
            )
            .await;
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
