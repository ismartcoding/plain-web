mod commands;
mod http_proxy;
mod local;

use std::sync::Arc;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .targets([
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stderr),
                ])
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .manage(commands::HttpClient::new())
        .setup(|app| {
            app.handle().manage(http_proxy::HttpProxyState::start());
            let data_dir = app.path().app_data_dir().unwrap_or_else(|_| std::path::PathBuf::from("."));
            let db_path = data_dir.join("local_chat.db");
            let db = match local::db::ChatDb::open(&db_path) {
                Ok(d) => Arc::new(d),
                Err(e) => panic!("local_db open failed: {e}"),
            };
            // Ensure persistent device identity (generates on first run).
            let identity = Arc::new(local::crypto::ensure_identity(&db));
            // Pairing manager. We do NOT start a persistent UDP listener on
            // port 52352 because that conflicts with the short-lived discovery
            // scan socket (commands::scan_blocking) which also binds 52352 to
            // receive DISCOVER_REPLY datagrams. Pairing is initiator-only for
            // now: pair_device sends PAIR_REQUEST and waits for PAIR_RESPONSE
            // on its own socket bound just for the pairing window.
            let (pairing_mgr, mut pairing_rx) =
                local::pairing::PairingManager::new(db.clone(), identity.clone());
            // Bridge pairing broadcast → Tauri event "pairing-event".
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                use tauri::Emitter;
                while let Ok(ev) = pairing_rx.recv().await {
                    let _ = app_handle.emit("pairing-event", ev);
                }
            });
            app.handle().manage(pairing_mgr);
            app.handle().manage(local::server::LocalServerState::start(data_dir, db, identity));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::discover_devices,
            commands::http_request,
            commands::ws_start_proxy,
            commands::send_macos_notification,
            http_proxy::http_proxy_port,
            local::server::local_server_port,
            local::server::local_server_https_port,
            local::server::local_server_token,
            local::pairing::pair_device,
            local::pairing::respond_pair_device,
            local::pairing::cancel_pair_device,
            local::pairing::get_device_identity,
            local::pairing::set_device_name,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
