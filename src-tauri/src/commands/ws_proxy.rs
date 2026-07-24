//! WebSocket local-proxy (bypasses WKWebView TLS validation and local ws:// restrictions).
//!
//! Instead of routing WS frames through Tauri IPC events, Rust opens a plain
//! (non-TLS) TCP listener on 127.0.0.1:0 and returns the assigned port to JS.
//! JS then does:  new WebSocket('ws://127.0.0.1:<port>')
//! Rust accepts that connection, upgrades it to WS, then connects to the real
//! device WS/WSS URL (with danger_accept_invalid_certs for WSS) and relays
//! frames in both directions. No custom IPC serialisation — TCP carries the
//! data directly.

#[tauri::command]
pub async fn ws_start_proxy(url: String) -> Result<u16, String> {
    use futures_util::SinkExt;
    use tokio::net::TcpListener;

    // Normalise the URL so the request line always has a path. tungstenite's
    // `connect_async` emits `GET ?query HTTP/1.1` for URLs like
    // `ws://host:port?query` (no path), which the local server's
    // `accept_async` rejects as "HTTP format error: invalid format". Inserting
    // a `/` before the `?` produces a valid `GET /?query HTTP/1.1` line.
    let url = if url.contains("://") {
        let after_scheme = url.split("://").nth(1).unwrap_or("");
        if after_scheme.contains('?') && !after_scheme.contains('/') {
            let (before_q, after_q) = url.split_once('?').unwrap_or((&url, ""));
            format!("{before_q}/?{after_q}")
        } else {
            url
        }
    } else {
        url
    };

    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();

    tauri::async_runtime::spawn(async move {
        // Accept exactly one connection from JS (each WebSocket gets its own proxy).
        let Ok((tcp, _)) = listener.accept().await else {
            return;
        };

        // Handshake local side (plain WS — no TLS needed for localhost).
        let Ok(mut local_ws) = tokio_tungstenite::accept_async(tcp).await else {
            return;
        };

        // Connect to the target. For ws:// (local server) use plain TCP; for
        // wss:// (device) use TLS with self-signed cert acceptance.
        let device_ws = if url.starts_with("wss://") {
            let tls = match native_tls::TlsConnector::builder()
                .danger_accept_invalid_certs(true)
                .build()
            {
                Ok(t) => t,
                Err(_) => {
                    let _ = local_ws.close(None).await;
                    return;
                }
            };
            let connector = tokio_tungstenite::Connector::NativeTls(tls);
            match tokio_tungstenite::connect_async_tls_with_config(
                url.as_str(),
                None,
                false,
                Some(connector),
            )
            .await
            {
                Ok((ws, _)) => ws,
                Err(_) => {
                    let _ = local_ws.close(None).await;
                    return;
                }
            }
        } else {
            match tokio_tungstenite::connect_async(url.as_str()).await {
                Ok((ws, _)) => ws,
                Err(_) => {
                    let _ = local_ws.close(None).await;
                    return;
                }
            }
        };

        use futures_util::StreamExt;
        let (mut local_tx, mut local_rx) = local_ws.split();
        let (mut device_tx, mut device_rx) = device_ws.split();

        // Relay frames in both directions until either side closes.
        tokio::select! {
            _ = async {
                while let Some(Ok(msg)) = local_rx.next().await {
                    if device_tx.send(msg).await.is_err() { break; }
                }
            } => {}
            _ = async {
                while let Some(Ok(msg)) = device_rx.next().await {
                    if local_tx.send(msg).await.is_err() { break; }
                }
            } => {}
        }

        // Signal closure to frontend after relay exits for any reason.
        let _ = local_tx.close().await;
    });

    Ok(port)
}
