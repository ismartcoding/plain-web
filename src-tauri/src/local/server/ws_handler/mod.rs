use std::sync::Arc;
use tokio::sync::broadcast;

use super::super::graphql::{AppCtx, WsEvent};

mod chat;
mod status;

/// Returns `true` if the peeked bytes look like an HTTP WebSocket upgrade request.
pub(super) fn is_ws_upgrade(data: &[u8]) -> bool {
    if data.len() < 4 || &data[..4] != b"GET " {
        return false;
    }
    let text = std::str::from_utf8(data)
        .unwrap_or_default()
        .to_ascii_lowercase();
    text.contains("upgrade: websocket")
}

/// Extract the request path (including query string) from the peeked bytes.
pub(super) fn ws_path(data: &[u8]) -> String {
    let text = std::str::from_utf8(data).unwrap_or_default();
    let line = text.lines().next().unwrap_or_default();
    let mut parts = line.split_whitespace();
    let _ = parts.next();
    parts.next().unwrap_or("/").to_string()
}

/// Route an accepted WebSocket connection to the appropriate handler.
pub(super) async fn handle_ws<S>(
    ws: tokio_tungstenite::WebSocketStream<S>,
    path: &str,
    token: &str,
    event_rx: broadcast::Receiver<WsEvent>,
    ctx: &Arc<AppCtx>,
) where
    S: tokio::io::AsyncRead + tokio::io::AsyncWrite + Unpin,
{
    if path.starts_with("/status") {
        status::handle(ws, path, ctx).await;
    } else {
        chat::handle(ws, path, token, event_rx, ctx).await;
    }
}

/// Extract a single query parameter value from a path string like `/foo?a=1&b=2`.
pub(super) fn query_param(path: &str, key: &str) -> Option<String> {
    let (_, query) = path.split_once('?')?;
    query.split('&').find_map(|pair| {
        let (k, v) = pair.split_once('=')?;
        if k == key {
            Some(v.to_string())
        } else {
            None
        }
    })
}
