#![allow(non_snake_case)]

#[path = "NearbyDiscoverManager.rs"]
mod nearby_discover_manager;
#[path = "NearbyNetwork.rs"]
mod nearby_network;
#[path = "NearbyPairManager.rs"]
mod nearby_pair_manager;
#[path = "PeerStatusManager.rs"]
mod peer_status_manager;

pub use nearby_discover_manager::{DiscoverDevicesResult, NearbyDiscoverManager};
pub use nearby_network::local_ipv4_strs as discover_local_ipv4_strs;
pub use peer_status_manager::PeerStatusManager;

#[tauri::command]
pub async fn discover_devices(
    state: tauri::State<'_, NearbyDiscoverManager>,
) -> Result<DiscoverDevicesResult, String> {
    nearby_discover_manager::discover_devices_impl(state).await
}
