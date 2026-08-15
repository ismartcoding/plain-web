//! Discovery manager over mDNS — mirrors plain-app `MdnsDiscoverManager`.
//!
//! Replaces the old LAN discovery (custom UDP multicast on
//! `224.0.0.100:52352`). Publishing the `_plainapp._tcp.local` service is
//! driven by the HTTPS server lifecycle (`LocalServerState::rebind` calls
//! [`publish_service`]), while this manager guarantees the shared responder
//! socket is up so the browser can send queries, and owns the browser
//! lifecycle.
//!
//! Pairing is handled over HTTPS via the `POST /nearby` REST endpoint
//! instead of UDP (see `local::pairing`).

use super::mdns::host_responder;
use super::mdns::service_browser::{FoundDevice, MdnsServiceBrowser};
use super::peer_status_manager::PeerStatusManager;
use crate::local::db::{ChatDb, now_iso};
use crate::local::graphql::{
    WS_NEARBY_DEVICE_FOUND, WS_NEARBY_DISCOVERY_STARTED, WS_NEARBY_DISCOVERY_STOPPED, WsEvent,
};
use crate::local::pairing::PairingManager;
use crate::prefs::AppIdentity;
use serde::Serialize;
use std::collections::HashMap;
use std::sync::{
    Arc, Mutex, RwLock,
    atomic::{AtomicU16, Ordering},
};
use std::time::Duration;
use tokio::sync::broadcast;

const LOCAL_DEVICE_TYPE_WIRE: &str = "COMPUTER";
/// Window a one-shot `discover_devices` scan listens for mDNS responses.
const SCAN_TIMEOUT_MS: u64 = 2_500;

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveredDevice {
    pub id: String,
    pub name: String,
    pub ips: Vec<String>,
    pub port: u16,
    pub device_type: String,
    #[serde(default)]
    pub version: String,
    #[serde(default)]
    pub platform: String,
    #[serde(default)]
    pub last_seen: String,
    #[serde(default)]
    pub status: String,
    #[serde(default)]
    pub discovery_methods: Vec<String>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "snake_case")]
#[allow(dead_code)]
pub enum DiscoverScanStatus {
    Ok,
    PermissionDenied,
    NetworkError,
}

#[derive(Serialize, Clone, Debug)]
pub struct DiscoverDevicesResult {
    pub devices: Vec<DiscoveredDevice>,
    pub status: DiscoverScanStatus,
}

#[derive(Clone)]
pub struct NearbyDiscoverManager {
    db: Arc<ChatDb>,
    identity: Arc<AppIdentity>,
    device_name: Arc<RwLock<String>>,
    pairing: PairingManager,
    peer_status: PeerStatusManager,
    https_port: Arc<AtomicU16>,
    event_tx: Arc<RwLock<Option<broadcast::Sender<WsEvent>>>>,
    browser: MdnsServiceBrowser,
    seen_in_session: Arc<Mutex<HashMap<String, DiscoveredDevice>>>,
}

impl NearbyDiscoverManager {
    pub fn new(
        db: Arc<ChatDb>,
        identity: Arc<AppIdentity>,
        device_name: Arc<RwLock<String>>,
        pairing: PairingManager,
        peer_status: PeerStatusManager,
        https_port: u16,
    ) -> Self {
        let this = NearbyDiscoverManager {
            db,
            identity,
            device_name,
            pairing,
            peer_status,
            https_port: Arc::new(AtomicU16::new(https_port)),
            event_tx: Arc::new(RwLock::new(None)),
            browser: MdnsServiceBrowser::new(String::new(), String::new(), |_| {}),
            seen_in_session: Arc::new(Mutex::new(HashMap::new())),
        };
        let callback_state = this.clone();
        let browser = MdnsServiceBrowser::new(
            this.identity.client_id.clone(),
            mdns_hostname(&this.identity.client_id),
            move |device: FoundDevice| callback_state.on_device_found(device),
        );
        Self { browser, ..this }
    }

    pub fn set_event_tx(&self, event_tx: broadcast::Sender<WsEvent>) {
        *self.event_tx.write().unwrap() = Some(event_tx);
    }

    /// Called by `LocalServerState::rebind` once the HTTPS port is bound.
    /// Also (re)publishes the `_plainapp._tcp.local` service so the desktop
    /// is discoverable by phones — mirrors plain-app's `NsdHelper.registerService`.
    pub fn set_https_port(&self, port: u16) {
        self.https_port.store(port, Ordering::SeqCst);
        self.publish_service();
    }

    /// Advertises the PlainApp service on the shared mDNS responder. The
    /// instance name is the device name; TXT records carry the identity
    /// (id / device type / version / platform).
    pub fn publish_service(&self) {
        let hostname = mdns_hostname(&self.identity.client_id);
        let port = self.https_port.load(Ordering::SeqCst);
        if port == 0 {
            return;
        }
        let service = super::mdns::service_info::build_service_info(
            &self.device_name.read().unwrap().clone(),
            &hostname,
            port,
            &self.identity.client_id,
            LOCAL_DEVICE_TYPE_WIRE,
            env!("CARGO_PKG_VERSION"),
            std::env::consts::OS,
            host_responder::local_ipv4_strs(),
        );
        host_responder::start(&hostname, Some(service));
    }

    /// Ensures the shared mDNS responder socket is up so the browser can
    /// send queries and the responder can answer PTR/SRV/TXT/A queries.
    /// Service registration itself happens with the HTTPS server lifecycle.
    pub fn start(&self) {
        host_responder::ensure_started(&mdns_hostname(&self.identity.client_id));
    }

    /// Mirrors plain-app's `startDiscovery` mutation: runs the mDNS browser
    /// loop that pushes discovered devices over the local server WS as
    /// `WS_NEARBY_DEVICE_FOUND`.
    pub fn start_discovery(&self) -> bool {
        if self.browser.is_running() {
            return false;
        }
        self.start();
        {
            let mut seen = self.seen_in_session.lock().unwrap();
            seen.clear();
        }
        self.emit_event(WS_NEARBY_DISCOVERY_STARTED, "{}");
        self.browser.start();
        true
    }

    /// Mirrors plain-app's `stopDiscovery` mutation.
    pub fn stop_discovery(&self) -> bool {
        if !self.browser.is_running() {
            return false;
        }
        self.browser.stop();
        {
            let mut seen = self.seen_in_session.lock().unwrap();
            seen.clear();
        }
        self.emit_event(WS_NEARBY_DISCOVERY_STOPPED, "{}");
        true
    }

    /// Mirrors plain-app's `isDiscovering` query.
    pub fn is_discovering(&self) -> bool {
        self.browser.is_running()
    }

    /// Triggers an immediate one-shot mDNS PTR browse. Responses for a paired
    /// peer refresh its IP/port via [`Self::update_known_peer`], letting
    /// `PeerStatusManager` detect whether the reply arrived within its wait
    /// window. Mirrors plain-app's `MdnsDiscoverManager.browse`.
    pub fn browse(&self) {
        self.browser.send_ptr_query();
    }

    /// Recreates the shared responder socket after a network change.
    /// mDNS multicast group membership is per-interface; when the device
    /// switches networks the new interface was never joined, so the old
    /// socket stops receiving multicast until it is recreated and re-joins
    /// on the fresh interface set. Mirrors plain-app's `scheduleRestart`.
    #[allow(dead_code)]
    pub fn schedule_restart(&self, reason: &str) {
        log::debug!("Network change ({reason}) — restarting mDNS responder");
        host_responder::restart_socket();
    }

    /// One-shot scan for the Tauri command surface: browse, wait out the
    /// response window, and return everything the browser accumulated.
    pub async fn discover_devices(&self) -> DiscoverDevicesResult {
        self.start();
        let first_scan = !self.browser.is_running();
        if first_scan {
            self.browser.start();
        }
        self.browser.send_ptr_query();
        tokio::time::sleep(Duration::from_millis(SCAN_TIMEOUT_MS)).await;
        let devices: Vec<DiscoveredDevice> = {
            let seen = self.seen_in_session.lock().unwrap();
            seen.values().cloned().collect()
        };
        if first_scan {
            self.browser.stop();
        }
        DiscoverDevicesResult {
            devices,
            status: DiscoverScanStatus::Ok,
        }
    }

    fn emit_event(&self, event_type: i32, payload: &str) {
        if let Some(tx) = self.event_tx.read().unwrap().clone() {
            let _ = tx.send(WsEvent {
                event_type,
                payload: payload.to_string(),
            });
        }
    }

    /// Browser callback — mirrors plain-app's `MdnsServiceBrowser.emitDevice`
    /// (`NearbyViewModel.handleNewDevice` + `PeerManager.applyDeviceDiscovered`).
    fn on_device_found(&self, device: FoundDevice) {
        let mut ips = device.ips.clone();
        ips.sort();
        let discovered = DiscoveredDevice {
            id: device.id.clone(),
            name: device.name.clone(),
            ips,
            port: device.port,
            device_type: device.device_type.to_string(),
            version: device.version.clone(),
            platform: device.platform.clone(),
            last_seen: now_iso(),
            status: self.get_device_status(&device.id),
            discovery_methods: vec!["LAN".to_string()],
        };
        self.update_known_peer(&device);
        self.peer_status.set_online(&device.id, true);
        {
            let mut seen = self.seen_in_session.lock().unwrap();
            seen.insert(discovered.id.clone(), discovered.clone());
        }
        self.emit_event(
            WS_NEARBY_DEVICE_FOUND,
            &serde_json::to_string(&discovered).unwrap_or_default(),
        );
    }

    /// Refreshes a known peer's address info from an mDNS response — mirrors
    /// plain-app's `PeerManager.applyDeviceDiscovered` (bumps `updatedAt`).
    fn update_known_peer(&self, device: &FoundDevice) {
        let Some(mut peer) = self.db.get_peer_by_id(&device.id) else {
            return;
        };
        peer.name = device.name.clone();
        peer.ip = device.ips.join(",");
        peer.port = device.port;
        peer.device_type = device.device_type;
        peer.updated_at = now_iso();
        self.db.upsert_peer(&peer);
    }

    /// Mirrors plain-app's `NearbyViewModel.getStatus(deviceId, paired)`:
    /// PAIRING if a pairing session is in flight, else PAIRED if the peer
    /// exists in the DB with Paired status, else UNPAIRED.
    fn get_device_status(&self, device_id: &str) -> String {
        if self.pairing.is_pairing(device_id) {
            return "PAIRING".to_string();
        }
        match self.db.get_peer_by_id(device_id) {
            Some(peer) if peer.is_paired() => "PAIRED".to_string(),
            _ => "UNPAIRED".to_string(),
        }
    }
}

/// Deterministic mDNS hostname for this device — e.g. `plainapp-a1b2c3d4.local`.
pub fn mdns_hostname(client_id: &str) -> String {
    let suffix: String = client_id
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .take(8)
        .collect();
    format!("plainapp-{suffix}")
}

pub async fn discover_devices_impl(
    state: tauri::State<'_, NearbyDiscoverManager>,
) -> Result<DiscoverDevicesResult, String> {
    Ok(state.discover_devices().await)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mdns_hostname_uses_client_id_prefix() {
        assert_eq!(
            mdns_hostname("a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d"),
            "plainapp-a1b2c3d4"
        );
        assert_eq!(mdns_hostname("short"), "plainapp-short");
        assert_eq!(mdns_hostname(""), "plainapp-");
    }
}
