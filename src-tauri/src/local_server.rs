//! Local HTTP+HTTPS+WebSocket server for offline/local mode.
//!
//! - HTTP on :8080 (fallback :0) — handles plain requests AND WebSocket upgrades.
//! - HTTPS on :8443 (fallback :0) — handles encrypted requests only.
//! - WebSocket on the HTTP port: frontend connects for real-time chat events.

use crate::local_crypto::{gen_token, xchacha_decrypt, xchacha_encrypt};
use crate::local_db::ChatDb;
use crate::local_server_data::{encode_ws_event, execute_graphql, WsEvent};
use crate::local_tls::{build_acceptor, ensure_cert};
use futures_util::{SinkExt, StreamExt};
use serde_json::{json, Value};
use std::net::TcpListener as StdTcpListener;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt, BufReader};
use tokio::sync::broadcast;
use tokio_rustls::TlsAcceptor;
use tokio_tungstenite::tungstenite::Message;

const APP_ID: &str = "com.ismartcoding.plainapp";
const CORS: &[u8] = b"access-control-allow-origin: *\r\n\
                       access-control-allow-methods: GET, POST, PUT, DELETE, OPTIONS\r\n\
                       access-control-allow-headers: *\r\n";

pub struct LocalServerState {
    pub port: u16,
    pub https_port: u16,
    pub token: String,
}

impl LocalServerState {
    pub fn start(app_data_dir: PathBuf, db: Arc<ChatDb>) -> Self {
        let http_listener = bind_listener(8080);
        let port = http_listener.local_addr().expect("local server addr").port();
        http_listener.set_nonblocking(true).expect("set_nonblocking");

        let https_listener = bind_listener(8443);
        let https_port = https_listener.local_addr().expect("https addr").port();
        https_listener.set_nonblocking(true).expect("set_nonblocking https");

        let token = gen_token();

        // Broadcast channel for WebSocket events (chat mutations → all WS clients).
        let (event_tx, _) = broadcast::channel::<WsEvent>(64);

        // Build TLS acceptor — generate self-signed cert if missing.
        let acceptor: Option<Arc<TlsAcceptor>> = match ensure_cert(&app_data_dir) {
            Ok((cert_pem, key_pem)) => match build_acceptor(&cert_pem, &key_pem) {
                Ok(a) => Some(Arc::new(a)),
                Err(e) => {
                    log::error!("local_server: failed to build TLS acceptor: {e}");
                    None
                }
            },
            Err(e) => {
                log::error!("local_server: failed to ensure cert: {e}");
                None
            }
        };

        // ── HTTP + WebSocket listener ─────────────────────────────────────────
        {
            let db = db.clone();
            let token_arc = Arc::new(token.clone());
            let event_tx = event_tx.clone();
            tauri::async_runtime::spawn(async move {
                let listener =
                    tokio::net::TcpListener::from_std(http_listener).expect("http listener");
                loop {
                    let Ok((stream, _)) = listener.accept().await else {
                        continue;
                    };
                    let _ = stream.set_nodelay(true);
                    let db = db.clone();
                    let token = token_arc.clone();
                    let event_tx = event_tx.clone();
                    let event_rx = event_tx.subscribe();
                    tokio::spawn(async move {
                        // Peek first 4 bytes to detect WebSocket GET upgrades.
                        let mut peek = [0u8; 512];
                        let n = stream.peek(&mut peek).await.unwrap_or(0);
                        if is_ws_upgrade(&peek[..n]) {
                            match tokio_tungstenite::accept_async(stream).await {
                                Ok(ws) => handle_ws(ws, &token, event_rx).await,
                                Err(e) => log::debug!("local_server: WS accept error: {e}"),
                            }
                        } else {
                            let (rd, wr) = tokio::io::split(stream);
                            handle(rd, wr, &db, &token, &event_tx, port, https_port).await;
                        }
                    });
                }
            });
        }

        // ── HTTPS listener ───────────────────────────────────────────────────
        if let Some(acc) = acceptor {
            let db = db.clone();
            let token_arc = Arc::new(token.clone());
            let event_tx = event_tx.clone();
            let port_clone = https_port;
            tauri::async_runtime::spawn(async move {
                let listener = tokio::net::TcpListener::from_std(https_listener)
                    .expect("https listener");
                loop {
                    let Ok((stream, _)) = listener.accept().await else {
                        continue;
                    };
                    let _ = stream.set_nodelay(true);
                    let db = db.clone();
                    let token = token_arc.clone();
                    let event_tx = event_tx.clone();
                    let acc = acc.clone();
                    tokio::spawn(async move {
                        match acc.accept(stream).await {
                            Ok(tls_stream) => {
                                let (rd, wr) = tokio::io::split(tls_stream);
                                handle(rd, wr, &db, &token, &event_tx, port_clone, port_clone)
                                    .await;
                            }
                            Err(e) => log::debug!("local_server: TLS handshake error: {e}"),
                        }
                    });
                }
            });
        }

        LocalServerState { port, https_port, token }
    }
}

// ── Tauri commands ────────────────────────────────────────────────────────────

#[tauri::command]
pub fn local_server_port(state: tauri::State<'_, LocalServerState>) -> u16 {
    state.port
}

#[tauri::command]
pub fn local_server_https_port(state: tauri::State<'_, LocalServerState>) -> u16 {
    state.https_port
}

#[tauri::command]
pub fn local_server_token(state: tauri::State<'_, LocalServerState>) -> String {
    state.token.clone()
}

// ── TCP listener binding ──────────────────────────────────────────────────────

fn bind_listener(preferred: u16) -> StdTcpListener {
    StdTcpListener::bind(format!("0.0.0.0:{preferred}"))
        .or_else(|_| StdTcpListener::bind("0.0.0.0:0"))
        .expect("local server bind")
}

// ── WebSocket upgrade detection ───────────────────────────────────────────────

fn is_ws_upgrade(data: &[u8]) -> bool {
    if data.len() < 4 || &data[..4] != b"GET " {
        return false;
    }
    let text = std::str::from_utf8(data).unwrap_or_default().to_ascii_lowercase();
    text.contains("upgrade: websocket")
}

// ── WebSocket handler ─────────────────────────────────────────────────────────

async fn handle_ws(
    ws: tokio_tungstenite::WebSocketStream<tokio::net::TcpStream>,
    token: &str,
    mut event_rx: broadcast::Receiver<WsEvent>,
) {
    let (mut tx, mut rx) = ws.split();
    let token = token.to_string();

    loop {
        tokio::select! {
            // Forward server events to the WebSocket client.
            event = event_rx.recv() => {
                match event {
                    Ok(ev) => {
                        if let Some(bytes) = encode_ws_event(&ev, &token) {
                            if tx.send(Message::Binary(bytes)).await.is_err() {
                                break;
                            }
                        }
                    }
                    Err(broadcast::error::RecvError::Lagged(_)) => continue,
                    Err(_) => break,
                }
            }
            // Drain incoming client messages (auth ping etc.) without processing them.
            msg = rx.next() => {
                match msg {
                    Some(Ok(Message::Close(_))) | None => break,
                    Some(Err(_)) => break,
                    _ => {}
                }
            }
        }
    }
}

// ── HTTP request handler (generic over stream type for HTTP+HTTPS) ────────────

async fn handle<R, W>(
    rd: R,
    mut wr: W,
    db: &ChatDb,
    token: &str,
    event_tx: &broadcast::Sender<WsEvent>,
    port: u16,
    https_port: u16,
) where
    R: AsyncRead + Unpin,
    W: AsyncWrite + Unpin,
{
    let mut reader = BufReader::new(rd);

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
    let path = parts[1].split('?').next().unwrap_or(parts[1]).to_owned();

    let mut content_length = 0usize;
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
            if k.trim().eq_ignore_ascii_case("content-length") {
                content_length = v.trim().parse().unwrap_or(0);
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
        ("GET", "/health_check") => {
            respond(&mut wr, 200, "OK", APP_ID.as_bytes(), "text/plain").await
        }
        ("POST", "/init") => respond(&mut wr, 200, "OK", b"", "text/plain").await,
        ("POST", "/graphql") | ("POST", "/peer_graphql") => {
            let Some(plaintext) = xchacha_decrypt(token, &body) else {
                respond(&mut wr, 401, "Unauthorized", b"", "text/plain").await;
                return;
            };
            let json_bytes = strip_replay_prefix(&plaintext);
            let request: Value =
                serde_json::from_slice(json_bytes).unwrap_or_else(|_| json!({}));
            let response_json =
                execute_graphql(request, Arc::new(db.clone()), token, event_tx, port, https_port);
            let response_text = response_json.to_string();
            match xchacha_encrypt(token, response_text.as_bytes()) {
                Some(encrypted) => {
                    respond(&mut wr, 200, "OK", &encrypted, "application/octet-stream").await
                }
                None => {
                    respond(&mut wr, 500, "Internal Server Error", b"", "text/plain").await
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

async fn respond<W: AsyncWrite + Unpin>(
    wr: &mut W,
    status: u16,
    reason: &str,
    body: &[u8],
    content_type: &str,
) {
    let head = format!(
        "HTTP/1.1 {status} {reason}\r\ncontent-type: {content_type}\r\ncontent-length: {}\r\nconnection: close\r\n",
        body.len()
    );
    let _ = wr.write_all(head.as_bytes()).await;
    let _ = wr.write_all(CORS).await;
    let _ = wr.write_all(b"\r\n").await;
    let _ = wr.write_all(body).await;
}
