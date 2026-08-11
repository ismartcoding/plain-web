mod commands;
mod crypto;
mod http_proxy;
mod local;
mod prefs;
mod utils;

use std::sync::Arc;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(if cfg!(debug_assertions) {
                    log::LevelFilter::Debug
                } else {
                    log::LevelFilter::Info
                })
                .targets([
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stderr),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir {
                        file_name: Some("plain".to_string()),
                    }),
                ])
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(commands::HttpClient::new())
        .manage(commands::media_preview_pool::MediaPreviewState::default())
        .setup(|app| {
            #[cfg(target_os = "macos")]
            commands::macos_menu::setup(app)?;

            app.handle().manage(http_proxy::HttpProxyState::start());
            let data_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| std::path::PathBuf::from("."));
            let log_dir = app
                .path()
                .app_log_dir()
                .unwrap_or_else(|_| data_dir.join("logs"));
            let db_path = data_dir.join("local_chat.db");
            let db = match local::db::ChatDb::open(&db_path) {
                Ok(d) => Arc::new(d),
                Err(e) => panic!("local_db open failed: {e}"),
            };
            // Ensure persistent device identity once at startup.
            let handle = app.handle().clone();
            let identity = Arc::new(crate::prefs::ensure_identity(&handle));
            let device_name = Arc::new(std::sync::RwLock::new(identity.device_name.clone()));
            let peer_status = commands::discover::PeerStatusManager::new(db.clone(), identity.clone());
            let pairing_mgr = local::pairing::PairingManager::new(db.clone(), identity.clone());
            app.handle().manage(pairing_mgr.clone());
            let discover_mgr = commands::discover::NearbyDiscoverManager::new(
                db.clone(),
                identity.clone(),
                device_name.clone(),
                pairing_mgr.clone(),
                peer_status.clone(),
                0,
            );
            let local_server_state = local::server::LocalServerState::start(
                data_dir,
                log_dir,
                db.clone(),
                handle,
                identity.clone(),
                device_name.clone(),
                peer_status.clone(),
                discover_mgr.clone(),
                pairing_mgr.clone(),
            );
            peer_status.set_event_tx(local_server_state.event_tx.clone());
            discover_mgr.set_event_tx(local_server_state.event_tx.clone());
            discover_mgr.set_https_port(local_server_state.https_port());
            discover_mgr.start();
            peer_status.set_discover_manager(discover_mgr.clone());
            peer_status.start();
            // Bridge pairing broadcast → both Tauri "pairing-event" and the
            // local-server WS `WS_PAIRING_*` events. The same event object
            // fans out to both transports so desktop (Tauri) and browser-only
            // (GraphQL/WebSocket) clients see identical pairing state.
            {
                let mut pairing_rx = pairing_mgr.subscribe();
                let app_handle = app.handle().clone();
                let ws_event_tx = local_server_state.event_tx.clone();
                tauri::async_runtime::spawn(async move {
                    use tauri::Emitter;
                    while let Ok(ev) = pairing_rx.recv().await {
                        log::info!(
                            "pairing_bridge: received PairingEvent kind={} device_id={}",
                            match &ev.kind {
                                crate::local::pairing::PairingEventKind::IncomingRequest { .. } => "IncomingRequest",
                                crate::local::pairing::PairingEventKind::Success => "Success",
                                crate::local::pairing::PairingEventKind::Failed { .. } => "Failed",
                                crate::local::pairing::PairingEventKind::Cancelled => "Cancelled",
                            },
                            ev.device_id
                        );
                        let _ = app_handle.emit("pairing-event", ev.clone());
                        forward_pairing_event_to_ws(&ws_event_tx, &ev);
                    }
                });
            }
            app.handle().manage(discover_mgr);
            app.handle().manage(local_server_state);
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                #[cfg(target_os = "macos")]
                commands::macos_dock::remove_window_device_name(window.label());
                // Any preview window dying (warm or visible) means we no
                // longer have a ready window. Rebuild so the next click is
                // fast. The user explicitly asked to let the close path
                // destroy the window — we don't intercept.
                commands::media_preview_pool::on_window_destroyed(
                    &window.app_handle().clone(),
                    window.label(),
                );
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::discover::discover_devices,
            commands::http_client::http_request,
            commands::ws_proxy::ws_start_proxy,
            commands::notification::send_macos_notification,
            commands::window::open_window,
            commands::window::set_window_device_name,
            commands::media_preview_pool::media_preview_init,
            commands::media_preview_pool::media_preview_activate,
            http_proxy::http_proxy_port,
            local::server::local_server_port,
            local::server::local_server_https_port,
            local::server::local_server_token,
            local::server::local_ipv4_strs,
            local::server::set_http_port,
            local::server::set_https_port,
            local::server::restart_server,
            local::pairing::commands::pair_device,
            local::pairing::commands::respond_pair_device,
            local::pairing::commands::cancel_pair_device,
            local::pairing::commands::get_device_identity,
            local::pairing::commands::set_device_name,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// Wire-format struct mirroring plain-app's `DPairingResult`
/// (`app/src/main/java/com/ismartcoding/plain/data/DNearbyPair.kt`).
/// Sent over the WebSocket for `PAIRING_SUCCESS` / `PAIRING_FAILED` /
/// `PAIRING_CANCELED` so the browser sees a single flat shape regardless of
/// whether the WebSocket is served by plain-web's local Rust server or
/// plain-app's Android HTTP server.
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct DPairingResult<'a> {
    device_id: &'a str,
    device_name: &'a str,
    error: &'a str,
}

/// Translate a `PairingEvent` into the appropriate `WsEvent` and push it
/// to the local GraphQL WebSocket. Mirrors the event-type constants used
/// by the browser-side `app-socket.ts` (`pairing_request_received`,
/// `pairing_success`, `pairing_failed`, `pairing_canceled`).
///
/// Payload shapes — must match plain-app's NearbyPairManager:
/// - `PAIRING_REQUEST_RECEIVED` → raw `PairingRequest` JSON
///   (the browser parses it as a `PairingRequest`)
/// - `PAIRING_SUCCESS` / `PAIRING_FAILED` / `PAIRING_CANCELED` → `DPairingResult`
///   JSON: `{ deviceId, deviceName, error }`
fn forward_pairing_event_to_ws(
    ws_event_tx: &tokio::sync::broadcast::Sender<
        crate::local::graphql::context::WsEvent,
    >,
    ev: &crate::local::pairing::PairingEvent,
) {
    use crate::local::graphql::context::{
        WsEvent, WS_PAIRING_CANCELLED, WS_PAIRING_FAILED,
        WS_PAIRING_REQUEST_RECEIVED, WS_PAIRING_SUCCESS,
    };
    use crate::local::pairing::PairingEventKind;

    let (event_type, payload) = match &ev.kind {
        PairingEventKind::IncomingRequest {
            request,
            sender_ip: _,
        } => {
            // plain-app sends the raw PairingRequest for `PAIRING_REQUEST_RECEIVED`.
            // Re-emit as raw JSON so the browser can parse it directly.
            match serde_json::to_string(request) {
                Ok(s) => (WS_PAIRING_REQUEST_RECEIVED, s),
                Err(_) => return,
            }
        }
        PairingEventKind::Success => {
            let result = DPairingResult {
                device_id: &ev.device_id,
                device_name: &ev.device_name,
                error: "",
            };
            match serde_json::to_string(&result) {
                Ok(s) => (WS_PAIRING_SUCCESS, s),
                Err(_) => return,
            }
        }
        PairingEventKind::Failed { reason } => {
            let result = DPairingResult {
                device_id: &ev.device_id,
                device_name: &ev.device_name,
                error: reason,
            };
            match serde_json::to_string(&result) {
                Ok(s) => (WS_PAIRING_FAILED, s),
                Err(_) => return,
            }
        }
        PairingEventKind::Cancelled => {
            let result = DPairingResult {
                device_id: &ev.device_id,
                device_name: &ev.device_name,
                error: "",
            };
            match serde_json::to_string(&result) {
                Ok(s) => (WS_PAIRING_CANCELLED, s),
                Err(_) => return,
            }
        }
    };
    let _ = ws_event_tx.send(WsEvent {
        event_type,
        payload,
    });
}
