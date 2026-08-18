#![allow(non_snake_case)]

#[path = "NearbyDiscoverManager.rs"]
mod nearby_discover_manager;
#[path = "PeerStatusManager.rs"]
mod peer_status_manager;

pub use nearby_discover_manager::NearbyDiscoverManager;
pub use peer_status_manager::PeerStatusManager;
use crate::local::enums::DeviceType;
use crate::local::graphql::schema::types::Peer;
pub(crate) use plain_rs::mdns::host_responder::get_best_ip as discover_get_best_ip;
pub(crate) use plain_rs::mdns::host_responder::local_ipv4_strs as discover_local_ipv4_strs;

// ── Remote-device login sessions (peers.token) ───────────────────────────────

/// Records a successful login: creates the peer as UNPAIRED (or refreshes the
/// existing row) with the session token.
#[tauri::command]
pub fn login_peer(
    state: tauri::State<'_, NearbyDiscoverManager>,
    id: String,
    name: String,
    host: String,
    deviceType: DeviceType,
    token: String,
    signaturePublicKey: String,
) {
    state.login_peer(&id, &name, &host, deviceType, &token, &signaturePublicKey);
}

/// Clears the login token of a peer (logout / forget device).
#[tauri::command]
pub fn logout_peer(state: tauri::State<'_, NearbyDiscoverManager>, id: String) {
    state.logout_peer(&id);
}

/// All peers with an active login token.
#[tauri::command]
pub fn list_login_peers(state: tauri::State<'_, NearbyDiscoverManager>) -> Vec<Peer> {
    state.login_peers()
}

/// Updates a peer's display name.
#[tauri::command]
pub fn update_peer_name(
    state: tauri::State<'_, NearbyDiscoverManager>,
    id: String,
    name: String,
) {
    state.update_peer_name(&id, &name);
}

/// Current `ip:port` of a paired peer from the peers table, kept fresh by
/// the resident mDNS listener. Used by the frontend to heal a stale login
/// session host without a multicast round-trip.
#[tauri::command]
pub fn peer_address(state: tauri::State<'_, NearbyDiscoverManager>, id: String) -> Option<String> {
    state.peer_address(&id)
}

// ── mDNS debug surface — mirrors plain-app's MdnsDebugPage + WebAddressBar ───

/// Read-only snapshot of every currently-known `_plainapp._tcp.local`
/// instance (raw wire data as parsed) — mirrors `MdnsServiceBrowser.snapshot`.
#[tauri::command]
pub fn mdns_snapshot(
    state: tauri::State<'_, NearbyDiscoverManager>,
) -> Vec<plain_rs::mdns::service_browser::MdnsServiceSnapshot> {
    state.mdns_snapshot()
}

/// Triggers an immediate one-shot mDNS PTR browse. The resident listener
/// refreshes a paired peer's IP/port, healing a stale WS dial on the next
/// reconnect.
#[tauri::command]
pub fn mdns_browse(state: tauri::State<'_, NearbyDiscoverManager>) {
    state.browse();
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
