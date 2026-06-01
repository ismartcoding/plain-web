use crate::local::pairing::PairingManager;

/// Thin adapter so the desktop code keeps the same discover module split as
/// plain-app. `NearbyDiscoverManager` routes PAIR_* datagrams through here.
pub struct NearbyPairManager;

impl NearbyPairManager {
    pub fn handle_datagram(pairing: &PairingManager, message: &str, sender_ip: &str) -> bool {
        pairing.handle_datagram(message, sender_ip)
    }
}
