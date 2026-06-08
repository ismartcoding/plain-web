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
            let (pairing_mgr, mut pairing_rx) =
                local::pairing::PairingManager::new(db.clone(), identity.clone());
            // Bridge pairing broadcast → Tauri event "pairing-event".
            let app_handle = handle.clone();
            tauri::async_runtime::spawn(async move {
                use tauri::Emitter;
                while let Ok(ev) = pairing_rx.recv().await {
                    let _ = app_handle.emit("pairing-event", ev);
                }
            });
            app.handle().manage(pairing_mgr.clone());
            let local_server_state = local::server::LocalServerState::start(
                data_dir,
                log_dir,
                db.clone(),
                handle,
                identity.clone(),
                device_name.clone(),
                peer_status.clone(),
            );
            peer_status.set_event_tx(local_server_state.event_tx.clone());
            let discover_mgr = commands::discover::NearbyDiscoverManager::new(
                db,
                identity,
                device_name,
                pairing_mgr.clone(),
                peer_status.clone(),
                local_server_state.https_port,
            );
            discover_mgr.start();
            peer_status.set_discover_manager(discover_mgr.clone());
            peer_status.start();
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
            local::pairing::commands::pair_device,
            local::pairing::commands::respond_pair_device,
            local::pairing::commands::cancel_pair_device,
            local::pairing::commands::get_device_identity,
            local::pairing::commands::set_device_name,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
