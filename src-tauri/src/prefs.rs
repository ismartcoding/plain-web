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

/// Read the currently saved device display name.
pub fn get_device_name(handle: &AppHandle) -> String {
    handle
        .store(STORE_FILE)
        .ok()
        .and_then(|s| s.get("device_name"))
        .and_then(|v| v.as_str().map(String::from))
        .unwrap_or_default()
}

/// User-configured HTTP port (default 8080, set via DeviceInfo card).
/// Matches plain-app's `HttpPortPreference` — single field is both the
/// user preference and the bound port; no separate "preferred" slot.
pub fn get_http_port(handle: &AppHandle) -> u16 {
    handle
        .store(STORE_FILE)
        .ok()
        .and_then(|s| s.get("http_port"))
        .and_then(|v| v.as_u64())
        .map(|p| p as u16)
        .unwrap_or(8080)
}

pub fn set_http_port(handle: &AppHandle, port: u16) {
    if let Ok(store) = handle.store(STORE_FILE) {
        store.set("http_port", port as u64);
        let _ = store.save();
    }
}

/// User-configured HTTPS port (default 8443, set via DeviceInfo card).
pub fn get_https_port(handle: &AppHandle) -> u16 {
    handle
        .store(STORE_FILE)
        .ok()
        .and_then(|s| s.get("https_port"))
        .and_then(|v| v.as_u64())
        .map(|p| p as u16)
        .unwrap_or(8443)
}

pub fn set_https_port(handle: &AppHandle, port: u16) {
    if let Ok(store) = handle.store(STORE_FILE) {
        store.set("https_port", port as u64);
        let _ = store.save();
    }
}

/// Allowed chars for the random mDNS host label — mirrors plain-app's
/// `MdnsHostnamePreference`: `('a'..'z')` minus the ambiguous `i l o v`.
const MDNS_HOSTNAME_CHARS: &[u8] = b"abcdefghjkmnpqrstuwxyz";

fn random_mdns_hostname_label() -> String {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    (0..2)
        .map(|_| MDNS_HOSTNAME_CHARS[rng.gen_range(0..MDNS_HOSTNAME_CHARS.len())] as char)
        .collect()
}

/// mDNS hostname for local-network discovery — mirrors plain-app's
/// `MdnsHostnamePreference.ensureValueAsync`: returns the stored value, or on
/// first run generates a random two-char host under `.local` and persists it.
pub fn ensure_mdns_hostname(handle: &AppHandle) -> String {
    let store = handle.store(STORE_FILE).expect("prefs store");
    if let Some(hostname) = store
        .get("mdns_hostname")
        .and_then(|v| v.as_str().map(String::from))
        .filter(|s| !s.is_empty())
    {
        return hostname;
    }
    let hostname = format!("{}.local", random_mdns_hostname_label());
    store.set("mdns_hostname", hostname.as_str());
    let _ = store.save();
    hostname
}

pub fn set_mdns_hostname(handle: &AppHandle, hostname: &str) {
    if let Ok(store) = handle.store(STORE_FILE) {
        store.set("mdns_hostname", hostname);
        let _ = store.save();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn random_mdns_hostname_label_is_two_allowed_chars() {
        for _ in 0..100 {
            let label = random_mdns_hostname_label();
            assert_eq!(label.len(), 2);
            assert!(label
                .chars()
                .all(|c| MDNS_HOSTNAME_CHARS.contains(&(c as u8))));
        }
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
