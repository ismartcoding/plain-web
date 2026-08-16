//! Main chat WebSocket handler (`/`).
//!
//! Mirrors Android's `WebSocket.kt` non-`auth=1` flow:
//! 1. Require `cid` query param (client ID for logging/session tracking).
//! 2. Expect the first Binary frame to be XChaCha20-encrypted with the URL
//!    token as the auth handshake — same as the `/graphql` endpoint.
//! 3. Once authenticated, forward broadcast events to the client until it
//!    disconnects.

use futures_util::{SinkExt, StreamExt};
use std::sync::Arc;
use tokio::sync::broadcast;
use tokio_tungstenite::tungstenite::Message;

use super::super::super::graphql::{AppCtx, WsEvent, encode_ws_event};
use plain_rs::xchacha_decrypt;

pub(super) async fn handle<S>(
    ws: tokio_tungstenite::WebSocketStream<S>,
    path: &str,
    token: &str,
    mut event_rx: broadcast::Receiver<WsEvent>,
    _ctx: &Arc<AppCtx>,
) where
    S: tokio::io::AsyncRead + tokio::io::AsyncWrite + Unpin,
{
    let cid = super::query_param(path, "cid").unwrap_or_default();
    if cid.is_empty() {
        log::debug!("local_server chat_ws: `cid` is missing");
        return;
    }

    let (mut sink, mut stream) = ws.split();

    // Auth handshake: first Binary frame must decrypt successfully with the URL token.
    loop {
        match stream.next().await {
            Some(Ok(Message::Binary(bytes))) => {
                if xchacha_decrypt(token, &bytes).is_some() {
                    break; // authenticated
                } else {
                    log::debug!("local_server chat_ws: invalid_request cid={cid}");
                    let _ = sink.close().await;
                    return;
                }
            }
            Some(Ok(Message::Close(_))) | None => return,
            Some(Err(_)) => return,
            _ => continue,
        }
    }

    log::debug!("local_server chat_ws: session added cid={cid}");
    let token = token.to_string();

    // Forward broadcast events to the client.
    log::info!(
        "local_server chat_ws: subscribed to event_tx for cid={cid} (initial receivers = {})",
        event_rx.len()
    );
    loop {
        tokio::select! {
            event = event_rx.recv() => {
                match event {
                    Ok(ev) => {
                        log::info!(
                            "local_server chat_ws: forwarding event type={} to cid={cid}",
                            ev.event_type
                        );
                        if let Some(bytes) = encode_ws_event(&ev, &token) {
                            log::info!(
                                "local_server chat_ws: encoded event type={} bytes={} to cid={cid}",
                                ev.event_type, bytes.len()
                            );
                            match sink.send(Message::Binary(bytes)).await {
                                Ok(_) => log::info!(
                                    "local_server chat_ws: sent event type={} to cid={cid}",
                                    ev.event_type
                                ),
                                Err(e) => {
                                    log::warn!(
                                        "local_server chat_ws: send failed type={} cid={cid} err={e}",
                                        ev.event_type
                                    );
                                    break;
                                }
                            }
                        } else {
                            log::warn!(
                                "local_server chat_ws: encode failed type={} cid={cid}",
                                ev.event_type
                            );
                        }
                    }
                    Err(broadcast::error::RecvError::Lagged(n)) => {
                        log::warn!(
                            "local_server chat_ws: lagged by {n} events for cid={cid}"
                        );
                        continue;
                    }
                    Err(_) => break,
                }
            }
            msg = stream.next() => {
                match msg {
                    Some(Ok(Message::Close(_))) | None => break,
                    Some(Err(_)) => break,
                    _ => {}
                }
            }
        }
    }

    log::debug!("local_server chat_ws: session removed cid={cid}");
}
