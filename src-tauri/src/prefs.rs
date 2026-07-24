use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

use crate::crypto::{base64_encode, ed25519_generate, gen_token};
use crate::utils::short_uuid;

pub const STORE_FILE: &str = "prefs.json";

/// Persistent device identity loaded from the preferences store.
#[derive(Clone, Debug)]
pub struct AppIdentity {
    pub client_id: String,
    pub device_name: String,
    /// Base64-encoded Ed25519 keypair bytes (64 bytes: private || public).
    pub ed25519_keypair: String,
}

/// Load (or generate on first run) the device identity from the preferences store.
pub fn ensure_identity(handle: &AppHandle) -> AppIdentity {
    let store = handle.store(STORE_FILE).expect("prefs store");

    let client_id = store
        .get("client_id")
        .and_then(|v| v.as_str().map(String::from))
        .unwrap_or_else(|| {
            let id = short_uuid::short_uuid();
            store.set("client_id", id.as_str());
            id
        });

    let device_name = store
        .get("device_name")
        .and_then(|v| v.as_str().map(String::from))
        .map(|s| s.trim().trim_end_matches('.').trim_end_matches(".local").to_string())
        .unwrap_or_else(|| {
            let name = default_device_name();
            store.set("device_name", name.as_str());
            name
        });

    let ed25519_keypair = store
        .get("signature_key_pair")
        .and_then(|v| v.as_str().map(String::from))
        .unwrap_or_else(|| {
            let (kp, _) = ed25519_generate();
            let kp_b64 = base64_encode(&kp);
            store.set("signature_key_pair", kp_b64.as_str());
            kp_b64
        });

    let _ = store.save();
    AppIdentity {
        client_id,
        device_name,
        ed25519_keypair,
    }
}

/// Return the persistent local-server URL token, generating it on first run.
pub fn get_url_token(handle: &AppHandle) -> String {
    let store = handle.store(STORE_FILE).expect("prefs store");
    store
        .get("url_token")
        .and_then(|v| v.as_str().map(String::from))
        .unwrap_or_else(|| {
            let token = gen_token();
            store.set("url_token", token.as_str());
            let _ = store.save();
            token
        })
}

/// Persist an updated device display name.
pub fn set_device_name(handle: &AppHandle, name: &str) {
    if let Ok(store) = handle.store(STORE_FILE) {
        store.set("device_name", name);
        let _ = store.save();
    }
}

/// Persist the HTTP port after the server binds.
pub fn set_http_port(handle: &AppHandle, port: u16) {
    if let Ok(store) = handle.store(STORE_FILE) {
        store.set("http_port", port as u64);
        let _ = store.save();
    }
}

/// Persist the HTTPS port after the server binds.
pub fn set_https_port(handle: &AppHandle, port: u16) {
    if let Ok(store) = handle.store(STORE_FILE) {
        store.set("https_port", port as u64);
        let _ = store.save();
    }
}

/// User-configured preferred HTTP port (set via DeviceInfo card). `None` means
/// use the default candidate list.
pub fn get_preferred_http_port(handle: &AppHandle) -> Option<u16> {
    handle
        .store(STORE_FILE)
        .ok()
        .and_then(|s| s.get("preferred_http_port"))
        .and_then(|v| v.as_u64())
        .map(|p| p as u16)
}

pub fn set_preferred_http_port(handle: &AppHandle, port: u16) {
    if let Ok(store) = handle.store(STORE_FILE) {
        store.set("preferred_http_port", port as u64);
        let _ = store.save();
    }
}

/// User-configured preferred HTTPS port (set via DeviceInfo card).
pub fn get_preferred_https_port(handle: &AppHandle) -> Option<u16> {
    handle
        .store(STORE_FILE)
        .ok()
        .and_then(|s| s.get("preferred_https_port"))
        .and_then(|v| v.as_u64())
        .map(|p| p as u16)
}

pub fn set_preferred_https_port(handle: &AppHandle, port: u16) {
    if let Ok(store) = handle.store(STORE_FILE) {
        store.set("preferred_https_port", port as u64);
        let _ = store.save();
    }
}

fn default_device_name() -> String {
    std::process::Command::new("hostname")
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.trim().trim_end_matches(".local").to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "PlainApp Desktop".to_string())
}
