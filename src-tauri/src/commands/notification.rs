use serde::Deserialize;

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct MacosNotificationOptions {
    pub title: String,
    pub body: Option<String>,
}

#[cfg(target_os = "macos")]
#[tauri::command]
pub async fn send_macos_notification(
    app: tauri::AppHandle,
    options: MacosNotificationOptions,
) -> Result<(), String> {
    let identifier = app.config().identifier.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let plain_script = macos_notification_script(&options.title, options.body.as_deref());
        let script = format!(
            "tell application id {}\n{}\nend tell",
            applescript_string(&identifier),
            plain_script
        );
        run_osascript(&script)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(target_os = "macos")]
fn macos_notification_script(title: &str, body: Option<&str>) -> String {
    format!(
        "display notification {} with title {}",
        applescript_string(body.unwrap_or("")),
        applescript_string(title)
    )
}

#[cfg(target_os = "macos")]
fn run_osascript(script: &str) -> Result<(), String> {
    let status = std::process::Command::new("osascript")
        .arg("-e")
        .arg(script)
        .status()
        .map_err(|e| e.to_string())?;
    if status.success() {
        Ok(())
    } else {
        Err(format!("osascript exited with status {status}"))
    }
}

#[cfg(target_os = "macos")]
fn applescript_string(value: &str) -> String {
    let escaped = value
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace(['\r', '\n'], " ");
    format!("\"{escaped}\"")
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub async fn send_macos_notification(_options: MacosNotificationOptions) -> Result<(), String> {
    Err("macOS notifications are only available on macOS".to_string())
}
