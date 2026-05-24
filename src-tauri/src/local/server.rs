//! Local HTTP+HTTPS+WebSocket server for offline/local mode.
//!
//! - HTTP on :8080 (fallback :0) — handles plain requests AND WebSocket upgrades.
//! - HTTPS on :8443 (fallback :0) — handles encrypted requests only.
//! - WebSocket on the HTTP port: frontend connects for real-time chat events.

use super::crypto::{base64_decode, chacha20_decrypt, chacha20_encrypt, ed25519_verify, gen_token, xchacha_decrypt, xchacha_encrypt};
use super::db::{ChatDb, DDeviceIdentity};
use super::graphql::{encode_ws_event, execute_graphql, new_peer_key_cache, PeerKeyCache, WsEvent};
use super::tls::{build_acceptor, ensure_cert};
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
    pub fn start(app_data_dir: PathBuf, db: Arc<ChatDb>, identity: Arc<DDeviceIdentity>) -> Self {
        let peer_key_cache = new_peer_key_cache();
        super::graphql::refresh_peer_key_cache(&db, &peer_key_cache);
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
            let identity = identity.clone();
            let peer_key_cache = peer_key_cache.clone();
            let token_arc = Arc::new(token.clone());
            let event_tx = event_tx.clone();
            let app_data_dir2 = app_data_dir.clone();
            tauri::async_runtime::spawn(async move {
                let listener =
                    tokio::net::TcpListener::from_std(http_listener).expect("http listener");
                loop {
                    let Ok((stream, _)) = listener.accept().await else {
                        continue;
                    };
                    let _ = stream.set_nodelay(true);
                    let db = db.clone();
                    let identity = identity.clone();
                    let peer_key_cache = peer_key_cache.clone();
                    let token = token_arc.clone();
                    let event_tx = event_tx.clone();
                    let event_rx = event_tx.subscribe();
                    let data_dir = app_data_dir2.clone();
                    tokio::spawn(async move {
                        // Peek first bytes to detect WebSocket GET upgrades.
                        let mut peek = [0u8; 512];
                        let n = stream.peek(&mut peek).await.unwrap_or(0);
                        if is_ws_upgrade(&peek[..n]) {
                            match tokio_tungstenite::accept_async(stream).await {
                                Ok(ws) => handle_ws(ws, &token, event_rx).await,
                                Err(e) => log::debug!("local_server: WS accept error: {e}"),
                            }
                        } else {
                            let (rd, wr) = tokio::io::split(stream);
                            handle(rd, wr, &db, &identity, &peer_key_cache, &token, &event_tx, port, https_port, &data_dir).await;
                        }
                    });
                }
            });
        }

        // ── HTTPS listener ───────────────────────────────────────────────────
        if let Some(acc) = acceptor {
            let db = db.clone();
            let identity = identity.clone();
            let peer_key_cache = peer_key_cache.clone();
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
                    let identity = identity.clone();
                    let peer_key_cache = peer_key_cache.clone();
                    let token = token_arc.clone();
                    let event_tx = event_tx.clone();
                    let acc = acc.clone();
                    let data_dir = app_data_dir.clone();
                    tokio::spawn(async move {
                        match acc.accept(stream).await {
                            Ok(tls_stream) => {
                                let (rd, wr) = tokio::io::split(tls_stream);
                                handle(rd, wr, &db, &identity, &peer_key_cache, &token, &event_tx, port_clone, port_clone, &data_dir)
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
    identity: &DDeviceIdentity,
    peer_key_cache: &PeerKeyCache,
    token: &str,
    event_tx: &broadcast::Sender<WsEvent>,
    port: u16,
    https_port: u16,
    data_dir: &std::path::Path,
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
        ("GET", "/health_check") => {
            respond(&mut wr, 200, "OK", APP_ID.as_bytes(), "text/plain").await
        }
        ("POST", "/init") => respond(&mut wr, 200, "OK", b"", "text/plain").await,
        ("GET", "/fs") => {
            serve_file(&mut wr, &query_str, data_dir).await;
        }
        ("POST", "/graphql") => {
            let Some(plaintext) = xchacha_decrypt(token, &body) else {
                respond(&mut wr, 401, "Unauthorized", b"", "text/plain").await;
                return;
            };
            let json_bytes = strip_replay_prefix(&plaintext);
            let request: Value =
                serde_json::from_slice(json_bytes).unwrap_or_else(|_| json!({}));
            let db_arc = Arc::new(db.clone());
            let id_arc = Arc::new(identity.clone());
            let response_json =
                execute_graphql(request, db_arc, id_arc, peer_key_cache, token, event_tx, port, https_port);
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
        ("POST", "/peer_graphql") => {
            // Authenticate incoming peer message:
            //   1. Look up peer by c-id header.
            //   2. Decrypt body with peer's shared key (ChaCha20Poly1305, 12B nonce).
            //   3. Verify Ed25519 signature: `{timestamp}{graphql_json}`.
            //   4. Check timestamp freshness (±5 min).
            let peer_opt = if header_client_id.is_empty() {
                None
            } else {
                db.get_peer_by_id(&header_client_id)
            };
            let Some(peer) = peer_opt else {
                respond(&mut wr, 401, "Unauthorized", b"unknown peer", "text/plain").await;
                return;
            };
            if !peer.is_paired() {
                respond(&mut wr, 401, "Unauthorized", b"not paired", "text/plain").await;
                return;
            }
            let key = base64_decode(&peer.key);
            let Some(plaintext_bytes) = chacha20_decrypt(&key, &body) else {
                respond(&mut wr, 401, "Unauthorized", b"decrypt failed", "text/plain").await;
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
            // Verify timestamp freshness.
            use std::time::{SystemTime, UNIX_EPOCH};
            let ts: i64 = ts_str.parse().unwrap_or(0);
            let now_ms = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as i64;
            if (now_ms - ts).abs() > 5 * 60 * 1000 {
                respond(&mut wr, 401, "Unauthorized", b"timestamp expired", "text/plain").await;
                return;
            }
            // Verify Ed25519 signature over `{timestamp}{graphql_json}`.
            let sig_data = format!("{ts}{gql_json}");
            if !ed25519_verify(&peer.public_key, sig_data.as_bytes(), sig_b64) {
                respond(&mut wr, 401, "Unauthorized", b"bad signature", "text/plain").await;
                return;
            }
            // Dispatch as incoming createChatItem.
            let mut request: Value =
                serde_json::from_str(gql_json).unwrap_or_else(|_| json!({}));
            // Inject fromId into variables so createChatItem_from_peer can use it.
            if let Some(vars) = request.get_mut("variables").and_then(Value::as_object_mut) {
                vars.insert("fromId".to_string(), json!(peer.id));
                if !header_channel_id.is_empty() {
                    vars.insert("channelId".to_string(), json!(header_channel_id));
                }
            }
            let db_arc = Arc::new(db.clone());
            let id_arc = Arc::new(identity.clone());
            let response_json =
                execute_graphql(request, db_arc, id_arc, peer_key_cache, token, event_tx, port, https_port);
            let response_text = response_json.to_string();
            match chacha20_encrypt(&key, response_text.as_bytes()) {
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

// ── /fs file serving ─────────────────────────────────────────────────────────

async fn serve_file<W: AsyncWrite + Unpin>(
    wr: &mut W,
    query_str: &str,
    data_dir: &std::path::Path,
) {
    // Parse `id` query param from `id=abc123.jpg&...`
    let file_id = query_str
        .split('&')
        .find_map(|kv| kv.strip_prefix("id="))
        .unwrap_or_default();
    if file_id.is_empty() {
        respond(wr, 400, "Bad Request", b"missing id", "text/plain").await;
        return;
    }
    // Path layout: {data_dir}/files/{hash[0:2]}/{hash[2:4]}/{id}
    let hash = file_id.split('.').next().unwrap_or(file_id);
    if hash.len() < 4 {
        respond(wr, 400, "Bad Request", b"invalid id", "text/plain").await;
        return;
    }
    let file_path = data_dir
        .join("files")
        .join(&hash[..2])
        .join(&hash[2..4])
        .join(file_id);
    match tokio::fs::read(&file_path).await {
        Ok(data) => {
            let mime = mime_from_ext(file_id);
            respond(wr, 200, "OK", &data, mime).await;
        }
        Err(_) => respond(wr, 404, "Not Found", b"", "text/plain").await,
    }
}

fn mime_from_ext(filename: &str) -> &'static str {
    match filename.rsplit('.').next().unwrap_or("").to_ascii_lowercase().as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "mp4" => "video/mp4",
        "mp3" => "audio/mpeg",
        "pdf" => "application/pdf",
        _ => "application/octet-stream",
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
