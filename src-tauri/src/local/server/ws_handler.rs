use futures_util::{SinkExt, StreamExt};
use tokio::sync::broadcast;
use tokio_tungstenite::tungstenite::Message;

use super::super::graphql::{encode_ws_event, WsEvent};

pub(super) fn is_ws_upgrade(data: &[u8]) -> bool {
    if data.len() < 4 || &data[..4] != b"GET " {
        return false;
    }
    let text = std::str::from_utf8(data)
        .unwrap_or_default()
        .to_ascii_lowercase();
    text.contains("upgrade: websocket")
}

pub(super) async fn handle_ws(
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
