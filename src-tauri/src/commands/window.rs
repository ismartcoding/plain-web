use tauri::{AppHandle, Manager};

/// Core logic — usable from both the Tauri command and the native menu handler.
pub fn create_window(app: &AppHandle, path: String) {
    // Reuse an existing window with the same path if one is already open.
    for win in app.webview_windows().values() {
        if win.url().map(|u| u.path() == path).unwrap_or(false) {
            let _ = win.set_focus();
            return;
        }
    }

    let label = format!(
        "window-{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis()
    );
    let url = tauri::WebviewUrl::App(path.into());
    if let Err(e) = tauri::WebviewWindowBuilder::new(app, &label, url)
        .title("")
        .inner_size(1200.0, 800.0)
        .min_inner_size(900.0, 600.0)
        .title_bar_style(tauri::TitleBarStyle::Overlay)
        .build()
    {
        log::error!("open_window failed: {e}");
    }
}

/// Always creates a new window at "/" without checking for an existing one.
/// Used by the macOS dock "New Window" action.
pub fn new_window(app: &AppHandle) {
    let label = format!(
        "window-{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis()
    );
    let url = tauri::WebviewUrl::App("/".into());
    if let Err(e) = tauri::WebviewWindowBuilder::new(app, &label, url)
        .title("")
        .inner_size(1200.0, 800.0)
        .min_inner_size(900.0, 600.0)
        .title_bar_style(tauri::TitleBarStyle::Overlay)
        .build()
    {
        log::error!("new_window failed: {e}");
    }
}

/// Open a new app window at the given path (e.g. "/messages").
/// If a window at that exact path is already open it receives focus instead.
#[tauri::command]
pub fn open_window(app: AppHandle, path: String) {
    create_window(&app, path);
}

/// Update the display name shown for this window in the macOS dock right-click menu.
/// The frontend calls this whenever the active device session changes.
#[tauri::command]
pub fn set_window_device_name(window: tauri::Window, name: String) {
    #[cfg(target_os = "macos")]
    crate::commands::macos_dock::set_window_device_name(window.label(), &name);
}
