use std::sync::{Arc, OnceLock};
use tokio::io::{AsyncWrite, AsyncWriteExt};

use super::super::graphql::context::AppCtx;
use super::response::respond;
use plain_rs::xchacha_decrypt;
use plain_rs::base64_decode;
use plain_rs::http::CORS;
use plain_rs::query::parse_query;

/// Proxy a peer file through the local server's `/proxyfs` endpoint.
///
/// Mirrors plain-app `web/routes/FilesRoutes.kt::addFilesRoutes().get("/proxyfs")`:
///   1. Decrypt the `id` query param with the local URL token → peer URL
///      (e.g. `https://peer-ip:port/fs?id=…`).
///   2. Validate the decrypted URL starts with `http`.
///   3. Forward the request (including the `Range` header) to the peer.
///   4. Stream the peer's response (status, headers, body) back to the
///      caller.
///
/// Why this exists: when a peer receives a chat message with `fsid:` URIs,
/// the web client builds a `/proxyfs` URL (see `lib/api/file.ts::getPeerProxyUrl`)
/// that wraps the peer's `/fs` URL. Routing through the local server avoids
/// the browser's mixed-content / self-signed-cert errors when fetching
/// directly from the peer's HTTPS endpoint.
pub(super) async fn proxy_file<W: AsyncWrite + Unpin>(
    wr: &mut W,
    query_str: &str,
    range_header: &str,
    ctx: &Arc<AppCtx>,
) {
    // 1. Parse + decrypt the id.
    let params = parse_query(query_str);
    let id_encoded = match params.get("id") {
        Some(s) if !s.is_empty() => s.clone(),
        _ => {
            respond(wr, 400, "Bad Request", b"missing id", "text/plain").await;
            return;
        }
    };
    let id_bytes = base64_decode(&id_encoded);
    let Some(plaintext) = xchacha_decrypt(&ctx.token, &id_bytes) else {
        respond(wr, 401, "Unauthorized", b"", "text/plain").await;
        return;
    };
    let peer_url = match std::str::from_utf8(&plaintext) {
        Ok(s) => s.to_string(),
        Err(_) => {
            respond(wr, 400, "Bad Request", b"invalid utf-8", "text/plain").await;
            return;
        }
    };

    // 2. Validate the peer URL.
    if !peer_url.starts_with("http") {
        respond(wr, 400, "Bad Request", b"Invalid peer URL", "text/plain").await;
        return;
    }

    // 3. Forward the request to the peer, forwarding the Range header
    //    so media seeking works through the proxy.
    let mut req = proxy_client().get(&peer_url);
    if !range_header.is_empty()
        && let Ok(v) = reqwest::header::HeaderValue::from_str(range_header) {
            req = req.header("range", v);
        }
    let mut resp = match req.send().await {
        Ok(r) => r,
        Err(e) => {
            let msg = e.to_string();
            respond(wr, 502, "Bad Gateway", msg.as_bytes(), "text/plain").await;
            return;
        }
    };

    // 4. Stream status + headers + body back. Hop-by-hop and CORS headers
    //    are stripped — we inject our own CORS preamble and `connection:
    //    close` framing.
    let status = resp.status();
    let resp_hdrs = resp.headers().clone();
    let status_line = format!(
        "HTTP/1.1 {} {}\r\n",
        status.as_u16(),
        status.canonical_reason().unwrap_or("")
    );
    if wr.write_all(status_line.as_bytes()).await.is_err() {
        return;
    }
    if wr.write_all(CORS).await.is_err() {
        return;
    }
    if wr.write_all(b"connection: close\r\n").await.is_err() {
        return;
    }
    for (k, v) in &resp_hdrs {
        match k.as_str() {
            "connection"
            | "keep-alive"
            | "transfer-encoding"
            | "access-control-allow-origin"
            | "access-control-allow-methods"
            | "access-control-allow-headers" => continue,
            _ => {}
        }
        if let Ok(vs) = v.to_str() {
            let line = format!("{}: {}\r\n", k.as_str(), vs);
            if wr.write_all(line.as_bytes()).await.is_err() {
                return;
            }
        }
    }
    if wr.write_all(b"\r\n").await.is_err() {
        return;
    }

    while let Ok(Some(data)) = resp.chunk().await {
        if wr.write_all(&data).await.is_err() {
            break;
        }
    }
    let _ = wr.flush().await;
}

/// Shared reqwest client for `/proxyfs` requests. Cloning is cheap —
/// `reqwest::Client` is an `Arc` internally, so all clones share one
/// connection pool. Built once with self-signed-cert tolerance so it
/// can reach peers whose local server uses a self-generated TLS cert.
fn proxy_client() -> reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT
        .get_or_init(|| {
            reqwest::Client::builder()
                .danger_accept_invalid_certs(true)
                .danger_accept_invalid_hostnames(true)
                .tcp_keepalive(std::time::Duration::from_secs(60))
                .pool_max_idle_per_host(20)
                .build()
                .expect("proxyfs reqwest client")
        })
        .clone()
}
