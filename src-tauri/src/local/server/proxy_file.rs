use std::fmt::Write as _;
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
        Some(s) if !s.is_empty() => s.as_str(),
        _ => {
            respond(wr, 400, "Bad Request", b"missing id", "text/plain").await;
            return;
        }
    };
    let id_bytes = base64_decode(id_encoded);
    let Some(plaintext) = xchacha_decrypt(&ctx.token, &id_bytes) else {
        respond(wr, 401, "Unauthorized", b"", "text/plain").await;
        return;
    };
    let peer_url = match std::str::from_utf8(&plaintext) {
        Ok(s) => s,
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
    let mut req = proxy_client().get(peer_url);
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

    // 4. Serialize the whole head (status + CORS + framing + forwarded
    //    headers) into one pre-sized buffer so it leaves as a single
    //    write — one TLS record / syscall instead of a dozen. Hop-by-hop
    //    and CORS headers are stripped; we inject our own.
    let head = build_head(resp.status(), resp.headers());
    if wr.write_all(head.as_bytes()).await.is_err() {
        return;
    }

    while let Ok(Some(mut data)) = resp.chunk().await {
        if wr.write_all_buf(&mut data).await.is_err() {
            break;
        }
    }
    let _ = wr.flush().await;
}

/// Serialize the proxy response head: status line, CORS preamble,
/// `connection: close` framing, then the peer's headers minus the
/// hop-by-hop and CORS ones (we inject our own). Non-UTF-8 header values
/// are skipped, matching the previous per-line behavior.
fn build_head(status: reqwest::StatusCode, headers: &reqwest::header::HeaderMap) -> String {
    let mut head = String::with_capacity(320 + headers.len() * 64);
    let _ = write!(
        head,
        "HTTP/1.1 {} {}\r\n",
        status.as_u16(),
        status.canonical_reason().unwrap_or("")
    );
    head.push_str(std::str::from_utf8(CORS).unwrap_or_default());
    head.push_str("connection: close\r\n");
    for (k, v) in headers {
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
            head.push_str(k.as_str());
            head.push_str(": ");
            head.push_str(vs);
            head.push_str("\r\n");
        }
    }
    head.push_str("\r\n");
    head
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
                .tcp_nodelay(true)
                .tcp_keepalive(std::time::Duration::from_secs(60))
                .pool_max_idle_per_host(20)
                .build()
                .expect("proxyfs reqwest client")
        })
        .clone()
}

#[cfg(test)]
mod tests {
    use super::*;
    use reqwest::header::{HeaderMap, HeaderValue};

    #[test]
    fn build_head_serializes_status_cors_and_headers() {
        let mut headers = HeaderMap::new();
        headers.insert("content-type", HeaderValue::from_static("video/mp4"));
        headers.insert("content-length", HeaderValue::from_static("42"));
        let head = build_head(reqwest::StatusCode::PARTIAL_CONTENT, &headers);
        assert!(head.starts_with("HTTP/1.1 206 Partial Content\r\n"));
        assert!(head.contains("access-control-allow-origin: *\r\n"));
        assert!(head.contains("connection: close\r\n"));
        assert!(head.contains("content-type: video/mp4\r\n"));
        assert!(head.contains("content-length: 42\r\n"));
        assert!(head.ends_with("\r\n\r\n"));
    }

    #[test]
    fn build_head_strips_hop_by_hop_and_cors_headers() {
        let mut headers = HeaderMap::new();
        headers.insert("transfer-encoding", HeaderValue::from_static("chunked"));
        headers.insert("keep-alive", HeaderValue::from_static("timeout=5"));
        headers.insert("connection", HeaderValue::from_static("keep-alive"));
        headers.insert(
            "access-control-allow-origin",
            HeaderValue::from_static("https://example.com"),
        );
        headers.insert("x-custom", HeaderValue::from_static("1"));
        let head = build_head(reqwest::StatusCode::OK, &headers);
        assert!(head.contains("x-custom: 1\r\n"));
        assert!(!head.contains("transfer-encoding"));
        assert!(!head.contains("keep-alive"));
        assert!(!head.contains("connection: keep-alive"));
        assert!(!head.contains("https://example.com"));
    }

    #[test]
    fn build_head_skips_non_utf8_values() {
        let mut headers = HeaderMap::new();
        headers.insert("x-bin", HeaderValue::from_bytes(&[0xff, 0xfe]).unwrap());
        headers.insert("x-ok", HeaderValue::from_static("yes"));
        let head = build_head(reqwest::StatusCode::OK, &headers);
        assert!(!head.contains("x-bin"));
        assert!(head.contains("x-ok: yes\r\n"));
    }

    #[test]
    fn build_head_unknown_status_has_empty_reason() {
        let head = build_head(
            reqwest::StatusCode::from_u16(599).unwrap(),
            &HeaderMap::new(),
        );
        assert!(head.starts_with("HTTP/1.1 599 \r\n"));
    }
}
