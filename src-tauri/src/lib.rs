mod commands;
mod http_proxy;

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
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::discover_devices,
            commands::http_request,
            commands::ws_start_proxy,
            http_proxy::http_proxy_port,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
