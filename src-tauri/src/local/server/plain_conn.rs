use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::broadcast;

use super::super::graphql::{AppCtx, LocalSchema, WsEvent};
use super::super::peer_graphql::PeerSchema;
use super::{http_handler, ws_handler};

/// Dispatch a plain TCP connection to either the WebSocket handler or the HTTP
/// handler, depending on whether the first bytes look like a WS upgrade request.
pub(super) async fn serve(
    stream: tokio::net::TcpStream,
    schema: Arc<LocalSchema>,
    peer_schema: Arc<PeerSchema>,
    ctx: Arc<AppCtx>,
    token: Arc<String>,
    event_rx: broadcast::Receiver<WsEvent>,
    data_dir: PathBuf,
) {
    let mut peek = [0u8; 512];
    let n = stream.peek(&mut peek).await.unwrap_or(0);
    let remote_ip = stream
        .peer_addr()
        .map(|a| a.ip().to_string())
        .unwrap_or_default();
    if ws_handler::is_ws_upgrade(&peek[..n]) {
        let path = ws_handler::ws_path(&peek[..n]);
        log::debug!("local_server: new WS connection path={path}");
        match tokio_tungstenite::accept_async(stream).await {
            Ok(ws) => ws_handler::handle_ws(ws, &path, &token, event_rx, &ctx).await,
            Err(e) => log::debug!("local_server: WS accept error: {e}"),
        }
    } else {
        let (rd, wr) = tokio::io::split(stream);
        http_handler::handle(rd, wr, &schema, &peer_schema, &ctx, &data_dir, &remote_ip).await;
    }
}
