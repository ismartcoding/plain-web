use std::path::PathBuf;
use std::sync::Arc;
use tokio::io::AsyncBufReadExt;
use tokio_rustls::TlsAcceptor;

use super::super::graphql::{AppCtx, LocalSchema};
use super::{http_handler, ws_handler};

/// Dispatch a TLS connection to either the WebSocket handler or the HTTP
/// handler. Uses `BufReader::fill_buf` to peek at the decrypted plaintext
/// (TLS streams do not expose a raw `peek` method).
pub(super) async fn serve(
    stream: tokio::net::TcpStream,
    acc: Arc<TlsAcceptor>,
    schema: Arc<LocalSchema>,
    ctx: Arc<AppCtx>,
    data_dir: PathBuf,
) {
    let tls_stream = match acc.accept(stream).await {
        Ok(s) => s,
        Err(e) => {
            log::debug!("local_server: TLS handshake error: {e}");
            return;
        }
    };
    let mut peek_reader = tokio::io::BufReader::with_capacity(512, tls_stream);
    let (is_ws, path) = match peek_reader.fill_buf().await {
        Ok(buf) => (ws_handler::is_ws_upgrade(buf), ws_handler::ws_path(buf)),
        Err(_) => (false, String::new()),
    };
    if is_ws {
        log::debug!("local_server: new WSS connection path={path}");
        let event_rx = ctx.event_tx.subscribe();
        match tokio_tungstenite::accept_async(peek_reader).await {
            Ok(ws) => ws_handler::handle_ws(ws, &path, &ctx.token, event_rx, &ctx).await,
            Err(e) => log::debug!("local_server: WSS accept error: {e}"),
        }
    } else {
        let (rd, wr) = tokio::io::split(peek_reader);
        http_handler::handle(rd, wr, &schema, &ctx, &data_dir).await;
    }
}
