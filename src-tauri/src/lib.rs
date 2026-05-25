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
            // Ensure persistent device identity via plugin-store (generates on first run).
            let handle = app.handle().clone();
            let (pairing_mgr, mut pairing_rx) =
                local::pairing::PairingManager::new(db.clone(), handle.clone());
            // Bridge pairing broadcast → Tauri event "pairing-event".
            let app_handle = handle.clone();
            tauri::async_runtime::spawn(async move {
                use tauri::Emitter;
                while let Ok(ev) = pairing_rx.recv().await {
                    let _ = app_handle.emit("pairing-event", ev);
                }
            });
            app.handle().manage(pairing_mgr);
            app.handle().manage(local::server::LocalServerState::start(data_dir, db, handle));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::discover::discover_devices,
            commands::http_client::http_request,
            commands::ws_proxy::ws_start_proxy,
            commands::notification::send_macos_notification,
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
