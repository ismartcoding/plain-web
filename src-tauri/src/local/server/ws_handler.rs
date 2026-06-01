use futures_util::{SinkExt, StreamExt};
use std::sync::Arc;
use tokio::sync::broadcast;
use tokio_tungstenite::tungstenite::Message;

use super::super::graphql::{AppCtx, WsEvent, encode_ws_event};
use crate::crypto::{base64_decode, chacha20_decrypt, ed25519_verify};

pub(super) fn is_ws_upgrade(data: &[u8]) -> bool {
    if data.len() < 4 || &data[..4] != b"GET " {
        return false;
    }
    let text = std::str::from_utf8(data)
        .unwrap_or_default()
        .to_ascii_lowercase();
    text.contains("upgrade: websocket")
}

pub(super) fn ws_path(data: &[u8]) -> String {
    let text = std::str::from_utf8(data).unwrap_or_default();
    let line = text.lines().next().unwrap_or_default();
    let mut parts = line.split_whitespace();
    let _ = parts.next();
    parts.next().unwrap_or("/").to_string()
}

pub(super) async fn handle_ws(
    ws: tokio_tungstenite::WebSocketStream<tokio::net::TcpStream>,
    path: &str,
    token: &str,
    mut event_rx: broadcast::Receiver<WsEvent>,
    ctx: &Arc<AppCtx>,
) {
    if path.starts_with("/status") {
        handle_status_ws(ws, path, ctx).await;
        return;
    }

    let (mut tx, mut rx) = ws.split();
    let token = token.to_string();

    loop {
        tokio::select! {
            event = event_rx.recv() => {
                match event {
                    Ok(ev) => {
                        if let Some(bytes) = encode_ws_event(&ev, &token) {
                            if tx.send(Message::Binary(bytes.into())).await.is_err() {
                                break;
                            }
                        }
                    }
                    Err(broadcast::error::RecvError::Lagged(_)) => continue,
                    Err(_) => break,
                }
            }
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

async fn handle_status_ws(
    ws: tokio_tungstenite::WebSocketStream<tokio::net::TcpStream>,
    path: &str,
    ctx: &Arc<AppCtx>,
) {
    let (mut tx, mut rx) = ws.split();
    let Some(peer_id) = query_param(path, "cid").filter(|value| !value.is_empty()) else {
        let _ = tx.close().await;
        return;
    };
    let mut authenticated = false;

    while let Some(message) = rx.next().await {
        match message {
            Ok(Message::Binary(bytes)) if !authenticated => {
                if authenticate_status_peer(&peer_id, bytes.as_ref(), ctx) {
                    authenticated = true;
                    ctx.peer_status.set_online(&peer_id, true);
                    if tx.send(Message::Text("ok".into())).await.is_err() {
                        break;
                    }
                } else {
                    let _ = tx.close().await;
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

fn authenticate_status_peer(peer_id: &str, payload: &[u8], ctx: &AppCtx) -> bool {
    let Some(peer) = ctx.db.get_peer_by_id(peer_id) else {
        return false;
    };
    if !peer.is_paired() || peer.key.is_empty() || peer.public_key.is_empty() {
        return false;
    }

    let key = base64_decode(&peer.key);
    if key.len() != 32 {
        return false;
    }
    let Some(plaintext) = chacha20_decrypt(&key, payload) else {
        return false;
    };
    let Ok(text) = std::str::from_utf8(&plaintext) else {
        return false;
    };

    let mut parts = text.splitn(3, '|');
    let signature = parts.next().unwrap_or_default();
    let timestamp = parts.next().unwrap_or_default();
    let client_id = parts.next().unwrap_or_default();
    if client_id != peer_id {
        return false;
    }
    let Ok(timestamp_ms) = timestamp.parse::<i64>() else {
        return false;
    };
    if (now_ms() - timestamp_ms).abs() > 5 * 60 * 1000 {
        return false;
    }

    ed25519_verify(
        &peer.public_key,
        format!("{timestamp}{client_id}").as_bytes(),
        signature,
    )
}

fn query_param(path: &str, key: &str) -> Option<String> {
    let (_, query) = path.split_once('?')?;
    query.split('&').find_map(|pair| {
        let (k, v) = pair.split_once('=')?;
        if k == key { Some(v.to_string()) } else { None }
    })
}

fn now_ms() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}
