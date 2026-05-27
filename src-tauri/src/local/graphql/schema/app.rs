use async_graphql::{Context, Object};
use std::sync::Arc;

use super::super::context::AppCtx;
use super::types::App;

#[derive(Default)]
pub struct AppQuery;

#[Object]
impl AppQuery {
    async fn app(&self, ctx: &Context<'_>) -> App {
        let c = ctx.data_unchecked::<Arc<AppCtx>>();
        App {
            usb_connected: false,
            url_token: c.token.clone(),
            http_port: c.port as i32,
            https_port: c.https_port as i32,
            app_dir: c.data_dir.to_string_lossy().into_owned(),
            device_name: c.device_name.read().unwrap().clone(),
            battery: String::new(),
            app_version: String::new(),
            os_version: String::new(),
            channel: "LOCAL".to_string(),
            permissions: vec![],
            audios: vec![],
            audio_current: String::new(),
            audio_mode: String::new(),
            sdcard_path: String::new(),
            usb_disk_paths: vec![],
            internal_storage_path: String::new(),
            downloads_dir: String::new(),
            developer_mode: false,
            favorite_folders: vec![],
            debug: cfg!(debug_assertions),
        }
    }
}

#[derive(Default)]
pub struct AppMutation;

#[Object]
impl AppMutation {
    async fn update_device_name(&self, ctx: &Context<'_>, name: String) -> bool {
        let c = ctx.data_unchecked::<Arc<AppCtx>>();
        *c.device_name.write().unwrap() = name.clone();
        let prefs_path = c.data_dir.join("prefs.json");
        let text = std::fs::read_to_string(&prefs_path).unwrap_or_else(|_| "{}".to_string());
        let mut obj: serde_json::Map<String, serde_json::Value> =
            serde_json::from_str(&text).unwrap_or_default();
        obj.insert("device_name".to_string(), serde_json::Value::String(name));
        std::fs::write(&prefs_path, serde_json::to_string(&obj).unwrap_or_default()).is_ok()
    }
}
