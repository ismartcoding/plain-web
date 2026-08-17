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
use super::mdns::service_browser::{FoundDevice, MdnsServiceBrowser, MdnsServiceSnapshot};
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

/// A remote device with an active login token — the device-switcher list.
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct LoginPeer {
    pub client_id: String,
    pub name: String,
    pub host: String,
    pub token: String,
    /// TOFU Ed25519 key used to verify login signatures.
    pub signature_public_key: String,
    pub device_type: String,
    pub status: String,
    pub created_at: String,
}

fn split_host(host: &str) -> (String, u16) {
    match host.rsplit_once(':') {
        Some((ip, port)) => match port.parse::<u16>() {
            Ok(p) => (ip.to_string(), p),
            Err(_) => (host.to_string(), 8443),
        },
        None => (host.to_string(), 8443),
    }
}

#[derive(Clone)]
pub struct NearbyDiscoverManager {
    db: Arc<ChatDb>,
    identity: Arc<AppIdentity>,
    device_name: Arc<RwLock<String>>,
    mdns_hostname: Arc<RwLock<String>>,
    pairing: PairingManager,
    peer_status: PeerStatusManager,
    https_port: Arc<AtomicU16>,
    event_tx: Arc<RwLock<Option<broadcast::Sender<WsEvent>>>>,
    app_handle: Arc<RwLock<Option<tauri::AppHandle>>>,
    browser: MdnsServiceBrowser,
    seen_in_session: Arc<Mutex<HashMap<String, DiscoveredDevice>>>,
}

impl NearbyDiscoverManager {
    pub fn new(
        db: Arc<ChatDb>,
        identity: Arc<AppIdentity>,
        device_name: Arc<RwLock<String>>,
        mdns_hostname: Arc<RwLock<String>>,
        pairing: PairingManager,
        peer_status: PeerStatusManager,
        https_port: u16,
    ) -> Self {
        let this = NearbyDiscoverManager {
            db,
            identity,
            device_name,
            mdns_hostname,
            pairing,
            peer_status,
            https_port: Arc::new(AtomicU16::new(https_port)),
            event_tx: Arc::new(RwLock::new(None)),
            app_handle: Arc::new(RwLock::new(None)),
            browser: MdnsServiceBrowser::new(
                String::new(),
                Arc::new(RwLock::new(String::new())),
                |_| {},
            ),
            seen_in_session: Arc::new(Mutex::new(HashMap::new())),
        };
        let callback_state = this.clone();
        let browser = MdnsServiceBrowser::new(
            this.identity.client_id.clone(),
            this.mdns_hostname.clone(),
            move |device: FoundDevice| callback_state.on_device_found(device),
        );
        Self { browser, ..this }
    }

    pub fn set_event_tx(&self, event_tx: broadcast::Sender<WsEvent>) {
        *self.event_tx.write().unwrap() = Some(event_tx);
    }

    pub fn set_app_handle(&self, handle: tauri::AppHandle) {
        *self.app_handle.write().unwrap() = Some(handle);
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
        let hostname = self.mdns_hostname();
        let port = self.https_port.load(Ordering::SeqCst);
        let service = (port > 0).then(|| {
            super::mdns::service_info::build_service_info(
                &self.device_name.read().unwrap().clone(),
                &hostname,
                port,
                &self.identity.client_id,
                LOCAL_DEVICE_TYPE_WIRE,
                env!("CARGO_PKG_VERSION"),
                std::env::consts::OS,
                host_responder::local_ipv4_strs(),
            )
        });
        host_responder::start(&hostname, service);
    }

    /// Ensures the shared mDNS responder socket is up so the browser can
    /// send queries and the responder can answer PTR/SRV/TXT/A queries.
    /// Service registration itself happens with the HTTPS server lifecycle.
    /// The browser's packet listener is installed here as well and never
    /// removed: passive listening stays resident for the whole session so a
    /// paired peer's IP change is picked up without any page scanning.
    pub fn start(&self) {
        host_responder::ensure_started(&self.mdns_hostname());
        self.browser.install_listener();
    }

    /// Current mDNS hostname — mirrors plain-app's `TempData.mdnsHostname`.
    pub fn mdns_hostname(&self) -> String {
        self.mdns_hostname.read().unwrap().clone()
    }

    /// Persists and applies a new mDNS hostname — mirrors plain-app's
    /// `MdnsHostnamePreference` + `WebAddressBar` save path, applied
    /// immediately by re-publishing on the shared responder socket.
    pub fn set_mdns_hostname(&self, handle: &tauri::AppHandle, hostname: &str) {
        crate::prefs::set_mdns_hostname(handle, hostname);
        *self.mdns_hostname.write().unwrap() = hostname.to_string();
        self.publish_service();
        // Drop instances cached under the previous hostname and re-browse so
        // the debug snapshot reflects the change instead of showing stale data.
        self.browser.clear_instances();
        self.browser.send_ptr_query();
    }

    /// Read-only snapshot of every known `_plainapp._tcp.local` instance —
    /// mirrors plain-app's `MdnsServiceBrowser.snapshot` (`MdnsDebugPage`).
    pub fn mdns_snapshot(&self) -> Vec<MdnsServiceSnapshot> {
        self.browser.snapshot()
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
        // The resident packet listener (installed at app start) parses the
        // reply and refreshes the peer row; no scan loop needed here, so the
        // nearby list stays quiet unless a page is actually discovering.
        self.start();
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
        // A one-shot scan must reflect what THIS scan hears: stale entries
        // from an earlier scan would keep returning a peer's dead address.
        {
            let mut seen = self.seen_in_session.lock().unwrap();
            seen.clear();
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

    /// Current `ip:port` of a paired peer straight from the peers table.
    /// The resident mDNS listener keeps it fresh from the peer's own
    /// announcements, so host healing does not depend on an outgoing
    /// multicast query actually reaching the peer.
    pub fn peer_address(&self, id: &str) -> Option<String> {
        let peer = self
            .db
            .get_peer_by_id(id)
            .filter(|p| p.is_paired() || !p.token.is_empty())?;
        if peer.ip.is_empty() || peer.port == 0 {
            return None;
        }
        Some(format!("{}:{}", peer.best_ip(), peer.port))
    }

    /// Records a successful remote-device login (see `ChatDb::login_peer`).
    pub fn login_peer(
        &self,
        id: &str,
        name: &str,
        host: &str,
        device_type: &str,
        token: &str,
        signature_public_key: &str,
    ) {
        let (ip, port) = split_host(host);
        let dt = device_type
            .parse::<crate::local::enums::DeviceType>()
            .unwrap_or(crate::local::enums::DeviceType::Unknown);
        self.db
            .login_peer(id, name, &ip, port, dt, token, signature_public_key);
    }

    pub fn logout_peer(&self, id: &str) {
        self.db.logout_peer(id);
    }

    pub fn update_peer_name(&self, id: &str, name: &str) {
        self.db.update_peer_name(id, name);
    }

    pub fn login_peers(&self) -> Vec<LoginPeer> {
        self.db
            .get_login_peers()
            .into_iter()
            .map(|p| {
                let host = format!("{}:{}", p.best_ip(), p.port);
                LoginPeer {
                    client_id: p.id,
                    name: p.name,
                    host,
                    token: p.token,
                    signature_public_key: p.public_key,
                    device_type: p.device_type.to_string(),
                    status: format!("{:?}", p.status).to_uppercase(),
                    created_at: p.created_at,
                }
            })
            .collect()
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
        // Resident-listener path: always refresh a paired peer's address so a
        // changed IP is picked up by the next reconnect attempt even while
        // the nearby scan loop is off.
        self.update_known_peer(&device);
        // Scan-gated path: nearby-list events only fire while discovery runs.
        if !self.browser.is_running() {
            return;
        }
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
        // Paired peers (chat) and logged-in peers (token) both track the
        // device address; unrelated peers are left untouched.
        let Some(mut peer) = self
            .db
            .get_peer_by_id(&device.id)
            .filter(|p| p.is_paired() || !p.token.is_empty())
        else {
            return;
        };
        // mDNS announcements repeat every few seconds — skip the write when
        // nothing changed so the peers table isn't hammered by upserts.
        let ip = device.ips.join(",");
        if peer.name == device.name
            && peer.ip == ip
            && peer.port == device.port
            && peer.device_type == device.device_type
        {
            return;
        }
        peer.name = device.name.clone();
        peer.ip = ip;
        peer.port = device.port;
        peer.device_type = device.device_type;
        peer.updated_at = now_iso();
        self.db.upsert_peer(&peer);
        if let (Some(handle), Some(ip)) = (
            self.app_handle.read().unwrap().clone(),
            device.ips.iter().min(),
        ) {
            use tauri::Emitter;
            let _ = handle.emit(
                "device-host-changed",
                serde_json::json!({ "clientId": device.id, "host": format!("{ip}:{}", device.port) }),
            );
        }
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

pub async fn discover_devices_impl(
    state: tauri::State<'_, NearbyDiscoverManager>,
) -> Result<DiscoverDevicesResult, String> {
    Ok(state.discover_devices().await)
}

