//! Local HTTP proxy for browser-initiated requests.
//!
//! Solves the self-signed cert problem:
//!   browser ──plain HTTP──► 127.0.0.1:N ──TLS (self-signed ok)──► device
//!
//! Two request types it must handle well:
//!
//! 1. Thumbnails (<img> tags, many concurrent, small responses)
//!    → reqwest connection pool reuses TLS sessions → no per-request handshake overhead
//!
//! 2. Video/audio (<video> tag, Range requests, large response)
//!    → resp.chunk() streams bytes as they arrive, never buffers full body
//!    → when browser closes connection (video switched), write fails,
//!    loop exits, resp is dropped, reqwest closes upstream (body was
//!    abandoned mid-stream so the connection is NOT returned to the pool)
//!    → no stale upstream connections
//!
//! Target URL is passed via:
//!   a) _pt query parameter  — browser-initiated (<img>, <video>)
//!   b) x-proxy-target header — fetch/XHR

use std::net::TcpListener as StdTcpListener;
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;

#[cfg(test)]
mod tests;
mod utils;

use plain_rs::http::CORS;
use utils::extract_pt;

// ─── Public state ─────────────────────────────────────────────────────────────

pub struct HttpProxyState {
    pub port: u16,
}

impl HttpProxyState {
    /// Build a dedicated reqwest client (no timeout — video streaming is long-lived)
    /// and start accepting connections.
    pub fn start() -> Self {
        let client = reqwest::Client::builder()
            .danger_accept_invalid_certs(true)
            .danger_accept_invalid_hostnames(true)
            .tcp_keepalive(std::time::Duration::from_secs(60))
            .pool_max_idle_per_host(20)
            .build()
            .expect("proxy reqwest client");

        let std_listener = StdTcpListener::bind("127.0.0.1:0").expect("http proxy bind");
        let port = std_listener.local_addr().expect("http proxy addr").port();
        std_listener.set_nonblocking(true).expect("set_nonblocking");

        tauri::async_runtime::spawn(async move {
            let listener =
                tokio::net::TcpListener::from_std(std_listener).expect("listener from_std");
            loop {
                let Ok((stream, _)) = listener.accept().await else {
                    continue;
                };
                let c = client.clone();
                tokio::spawn(handle(stream, c));
            }
        });

        HttpProxyState { port }
    }
}

#[tauri::command]
pub fn http_proxy_port(state: tauri::State<'_, HttpProxyState>) -> u16 {
    state.port
}

// ─── Per-connection handler ───────────────────────────────────────────────────

async fn handle(stream: TcpStream, http: reqwest::Client) {
    let _ = stream.set_nodelay(true);
    let (rd, mut wr) = stream.into_split();
    let mut reader = BufReader::new(rd);

    // 1. Request line.
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

    // 2. Request headers.
    let mut req_headers: Vec<(String, String)> = Vec::new();
    loop {
        let mut line = String::new();
        if reader.read_line(&mut line).await.is_err() {
            return;
        }
        let t = line.trim_end_matches(['\r', '\n']);
        if t.is_empty() {
            break;
        }
        if let Some((k, v)) = t.split_once(':') {
            req_headers.push((k.trim().to_ascii_lowercase(), v.trim().to_owned()));
        }
    }

    // 3. OPTIONS preflight — answer locally.
    if method == "OPTIONS" {
        let _ = wr.write_all(b"HTTP/1.1 200 OK\r\n").await;
        let _ = wr.write_all(CORS).await;
        let _ = wr
            .write_all(b"content-length: 0\r\nconnection: close\r\n\r\n")
            .await;
        return;
    }

    // 4. Proxy target.
    let (path, pt) = extract_pt(&raw_path);
    let target_base = if !pt.is_empty() {
        pt.trim_end_matches('/').to_owned()
    } else {
        req_headers
            .iter()
            .find(|(k, _)| k == "x-proxy-target")
            .map(|(_, v)| v.trim_end_matches('/').to_owned())
            .unwrap_or_default()
    };
    if target_base.is_empty() {
        let _ = wr
            .write_all(b"HTTP/1.1 400 Bad Request\r\nconnection: close\r\n\r\n")
            .await;
        return;
    }

    // 5. Request body.
    let body_len: usize = req_headers
        .iter()
        .find(|(k, _)| k == "content-length")
        .and_then(|(_, v)| v.parse().ok())
        .unwrap_or(0);
    let mut body = vec![0u8; body_len];
    if body_len > 0 && reader.read_exact(&mut body).await.is_err() {
        return;
    }

    // 6. Forward request via reqwest (connection pool handles TLS reuse).
    let url = format!("{}{}", target_base, path);
    let req_method: reqwest::Method = method.parse().unwrap_or(reqwest::Method::GET);
    let mut builder = http.request(req_method, &url);
    for (k, v) in &req_headers {
        match k.as_str() {
            // Strip hop-by-hop and proxy-internal headers.
            "host" | "connection" | "transfer-encoding" | "x-proxy-target" => continue,
            _ => {
                if let (Ok(name), Ok(val)) = (
                    reqwest::header::HeaderName::from_bytes(k.as_bytes()),
                    reqwest::header::HeaderValue::from_str(v),
                ) {
                    builder = builder.header(name, val);
                }
            }
        }
    }
    if !body.is_empty() {
        builder = builder.body(body);
    }

    let mut resp = match builder.send().await {
        Ok(r) => r,
        Err(_) => {
            let _ = wr
                .write_all(b"HTTP/1.1 502 Bad Gateway\r\nconnection: close\r\n\r\n")
                .await;
            return;
        }
    };

    // 7. Forward response status + headers.
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
            // Skip hop-by-hop and CORS headers we already injected.
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

    // 8. Stream response body — never buffer the full body.
    //
    //    resp.chunk() returns the next piece of data as the device sends it.
    //    reqwest (hyper) dechunks Transfer-Encoding: chunked automatically,
    //    so we always get raw bytes regardless of how the device encoded them.
    //
    //    Cancellation: if the browser closes the connection (e.g. video
    //    switched), write_all returns an error, we break, resp is dropped.
    //    Because the body wasn't fully consumed, reqwest does NOT return this
    //    connection to the pool — it closes it. No stale upstream connections.
    while let Ok(Some(data)) = resp.chunk().await {
        if wr.write_all(&data).await.is_err() {
            break;
        }
    }
}
