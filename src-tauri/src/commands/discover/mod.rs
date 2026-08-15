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
