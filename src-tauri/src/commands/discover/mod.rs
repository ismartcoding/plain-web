#![allow(non_snake_case)]

pub(crate) mod mdns;
#[path = "NearbyDiscoverManager.rs"]
mod nearby_discover_manager;
#[path = "PeerStatusManager.rs"]
mod peer_status_manager;

pub use nearby_discover_manager::{DiscoverDevicesResult, NearbyDiscoverManager};
pub use peer_status_manager::PeerStatusManager;
pub(crate) use mdns::host_responder::get_best_ip as discover_get_best_ip;
pub(crate) use mdns::host_responder::local_ipv4_strs as discover_local_ipv4_strs;

#[tauri::command]
pub async fn discover_devices(
    state: tauri::State<'_, NearbyDiscoverManager>,
) -> Result<DiscoverDevicesResult, String> {
    nearby_discover_manager::discover_devices_impl(state).await
}

// ── mDNS debug surface — mirrors plain-app's MdnsDebugPage + WebAddressBar ───

/// Read-only snapshot of every currently-known `_plainapp._tcp.local`
/// instance (raw wire data as parsed) — mirrors `MdnsServiceBrowser.snapshot`.
#[tauri::command]
pub fn mdns_snapshot(
    state: tauri::State<'_, NearbyDiscoverManager>,
) -> Vec<mdns::service_browser::MdnsServiceSnapshot> {
    state.mdns_snapshot()
}

/// Starts periodic mDNS browsing (idempotent). Returns whether THIS call
/// started it, so the page can stop it on exit only when it started it —
/// mirrors `MdnsDebugPage.startedByPage`.
#[tauri::command]
pub fn mdns_start_browse(state: tauri::State<'_, NearbyDiscoverManager>) -> bool {
    state.start_discovery()
}

/// Stops periodic mDNS browsing started by `mdns_start_browse`.
#[tauri::command]
pub fn mdns_stop_browse(state: tauri::State<'_, NearbyDiscoverManager>) -> bool {
    state.stop_discovery()
}

/// Current mDNS hostname — mirrors plain-app's `TempData.mdnsHostname`.
#[tauri::command]
pub fn mdns_get_hostname(state: tauri::State<'_, NearbyDiscoverManager>) -> String {
    state.mdns_hostname()
}

/// Persists and applies a new mDNS hostname. Validation mirrors plain-app's
/// `MdnsAndPortEditDialog`: non-blank with a `.local` suffix.
#[tauri::command]
pub fn mdns_set_hostname(
    handle: tauri::AppHandle,
    state: tauri::State<'_, NearbyDiscoverManager>,
    hostname: String,
) -> Result<(), String> {
    let hostname = hostname.trim();
    if hostname.is_empty() || !hostname.ends_with(".local") {
        return Err("mdns hostname must end with .local".to_string());
    }
    state.set_mdns_hostname(&handle, hostname);
    Ok(())
}
