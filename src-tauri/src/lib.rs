mod commands;
mod http_proxy;
mod local_crypto;
mod local_db;
mod local_server;
mod local_server_data;
mod local_tls;

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
            let db = match local_db::ChatDb::open(&db_path) {
                Ok(d) => std::sync::Arc::new(d),
                Err(e) => panic!("local_db open failed: {e}"),
            };
            app.handle().manage(local_server::LocalServerState::start(data_dir, db));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::discover_devices,
            commands::http_request,
            commands::ws_start_proxy,
            commands::send_macos_notification,
            http_proxy::http_proxy_port,
            local_server::local_server_port,
            local_server::local_server_https_port,
            local_server::local_server_token,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
