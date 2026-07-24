//! Local HTTP+HTTPS+WebSocket server for offline/local mode.
//!
//! - HTTP — plain requests and WebSocket upgrades.
//! - HTTPS — encrypted requests and WSS upgrades.
//!
//! Each listener tries a fixed candidate range in order, falling back to an
//! OS-assigned port only when every candidate is taken. The bound port is
//! recorded in `LocalServerState` and persisted via `prefs` so downstream
//! consumers (pairing, discovery, GraphQL) see the actual value.
//!
//! Per-connection dispatch lives in [`plain_conn`] (HTTP/WS) and
//! [`tls_conn`] (HTTPS/WSS); the listener loops here only accept and spawn.

use super::db::ChatDb;
use super::graphql::{
    build_schema, load_key_cache, new_channel_key_cache, new_peer_key_cache, refresh_peer_key_cache,
    AppCtx, WsEvent,
};
use super::peer_graphql::{build_schema as build_peer_schema, PeerSchema};
use super::tls::{build_acceptor, ensure_cert};
use crate::commands::discover::{NearbyDiscoverManager, PeerStatusManager};
use crate::prefs::AppIdentity;
use std::net::TcpListener as StdTcpListener;
use std::path::PathBuf;
use std::sync::{Arc, Mutex, RwLock};
use std::sync::atomic::{AtomicU16, Ordering};
use tauri::AppHandle;
use tokio::sync::broadcast;
use tokio_rustls::TlsAcceptor;

mod file_server;
mod http_handler;
pub(super) mod response;
mod plain_conn;
mod tls_conn;
mod upload;
pub(crate) mod uri;
mod ws_handler;

struct ServerHandle {
    http_task: tauri::async_runtime::JoinHandle<()>,
    https_task: Option<tauri::async_runtime::JoinHandle<()>>,
}

pub struct LocalServerState {
    pub token: String,
    pub event_tx: broadcast::Sender<WsEvent>,
    port: Arc<AtomicU16>,
    https_port: Arc<AtomicU16>,
    schema: Arc<async_graphql::Schema>,
    peer_schema: Arc<PeerSchema>,
    ctx: Arc<AppCtx>,
    acceptor: Option<Arc<TlsAcceptor>>,
    data_dir: PathBuf,
    handle: AppHandle,
    server: Mutex<ServerHandle>,
}

impl LocalServerState {
    #[allow(clippy::too_many_arguments)]
    pub fn start(
        app_data_dir: PathBuf,
        log_dir: PathBuf,
        db: Arc<ChatDb>,
        handle: AppHandle,
        identity: Arc<AppIdentity>,
        device_name: Arc<RwLock<String>>,
        peer_status: PeerStatusManager,
        discover_manager: NearbyDiscoverManager,
        pairing_manager: crate::local::pairing::PairingManager,
    ) -> Self {
        let peer_key_cache = new_peer_key_cache();
        let channel_key_cache = new_channel_key_cache();
        load_key_cache(&db, &peer_key_cache, &channel_key_cache);
        let _ = refresh_peer_key_cache;
        let port = Arc::new(AtomicU16::new(0));
        let https_port = Arc::new(AtomicU16::new(0));

        let token = crate::prefs::get_url_token(&handle);

        let (event_tx, _) = broadcast::channel::<WsEvent>(1024);

        let schema = Arc::new(build_schema());
        let peer_schema: Arc<PeerSchema> = Arc::new(build_peer_schema());
        let ctx = Arc::new(AppCtx {
            db: db.clone(),
            identity: identity.clone(),
            peer_status: peer_status.clone(),
            discover_manager: discover_manager.clone(),
            pairing_manager: pairing_manager.clone(),
            peer_key_cache: peer_key_cache.clone(),
            channel_key_cache: channel_key_cache.clone(),
            event_tx: event_tx.clone(),
            token: token.clone(),
            port: port.clone(),
            https_port: https_port.clone(),
            data_dir: app_data_dir.clone(),
            log_dir,
            device_name,
        });

        let acceptor: Option<Arc<TlsAcceptor>> = match ensure_cert(&app_data_dir) {
            Ok((cert_pem, key_pem)) => match build_acceptor(&cert_pem, &key_pem) {
                Ok(a) => Some(Arc::new(a)),
                Err(e) => {
                    log::error!("local_server: failed to build TLS acceptor: {e}");
                    None
                }
            },
            Err(e) => {
                log::error!("local_server: failed to ensure cert: {e}");
                None
            }
        };

        let mut state = LocalServerState {
            token: token.clone(),
            event_tx,
            port,
            https_port,
            schema,
            peer_schema,
            ctx,
            acceptor,
            data_dir: app_data_dir,
            handle: handle.clone(),
            server: Mutex::new(ServerHandle {
                http_task: tauri::async_runtime::spawn(async {}),
                https_task: None,
            }),
        };
        state.rebind();
        state
    }

    fn rebind(&self) {
        let http_candidates: Vec<u16> = crate::prefs::get_preferred_http_port(&self.handle)
            .into_iter()
            .chain(HTTP_PORTS.iter().copied())
            .collect();
        let http_listener = bind_listener(&http_candidates);
        let new_port = http_listener.local_addr().expect("local server addr").port();
        http_listener.set_nonblocking(true).expect("set_nonblocking");

        let https_candidates: Vec<u16> = crate::prefs::get_preferred_https_port(&self.handle)
            .into_iter()
            .chain(HTTPS_PORTS.iter().copied())
            .collect();
        let https_listener = bind_listener(&https_candidates);
        let new_https_port = https_listener.local_addr().expect("https addr").port();
        https_listener
            .set_nonblocking(true)
            .expect("set_nonblocking https");

        self.port.store(new_port, Ordering::Relaxed);
        self.https_port.store(new_https_port, Ordering::Relaxed);
        crate::prefs::set_http_port(&self.handle, new_port);
        crate::prefs::set_https_port(&self.handle, new_https_port);

        let token_arc = Arc::new(self.token.clone());
        let http_task = {
            let schema = self.schema.clone();
            let peer_schema = self.peer_schema.clone();
            let ctx = self.ctx.clone();
            let event_tx = self.event_tx.clone();
            let data_dir = self.data_dir.clone();
            tauri::async_runtime::spawn(async move {
                let listener =
                    tokio::net::TcpListener::from_std(http_listener).expect("http listener");
                loop {
                    let Ok((stream, _)) = listener.accept().await else {
                        continue;
                    };
                    let _ = stream.set_nodelay(true);
                    tokio::spawn(plain_conn::serve(
                        stream,
                        schema.clone(),
                        peer_schema.clone(),
                        ctx.clone(),
                        token_arc.clone(),
                        event_tx.subscribe(),
                        data_dir.clone(),
                    ));
                }
            })
        };

        let https_task = self.acceptor.as_ref().map(|acc| {
            let schema = self.schema.clone();
            let peer_schema = self.peer_schema.clone();
            let ctx = self.ctx.clone();
            let data_dir = self.data_dir.clone();
            let acc = acc.clone();
            tauri::async_runtime::spawn(async move {
                let listener =
                    tokio::net::TcpListener::from_std(https_listener).expect("https listener");
                loop {
                    let Ok((stream, _)) = listener.accept().await else {
                        continue;
                    };
                    let _ = stream.set_nodelay(true);
                    tokio::spawn(tls_conn::serve(
                        stream,
                        acc.clone(),
                        schema.clone(),
                        peer_schema.clone(),
                        ctx.clone(),
                        data_dir.clone(),
                    ));
                }
            })
        });

        let mut server = self.server.lock().unwrap();
        server.http_task.abort();
        if let Some(t) = server.https_task.take() {
            t.abort();
        }
        server.http_task = http_task;
        server.https_task = https_task;
    }

    pub fn restart(&self) {
        self.rebind();
    }

    pub fn port(&self) -> u16 {
        self.port.load(Ordering::Relaxed)
    }

    pub fn https_port(&self) -> u16 {
        self.https_port.load(Ordering::Relaxed)
    }
}

// ── Tauri commands ────────────────────────────────────────────────────────────

#[tauri::command]
pub fn local_server_port(state: tauri::State<'_, LocalServerState>) -> u16 {
    state.port()
}

#[tauri::command]
pub fn local_server_https_port(state: tauri::State<'_, LocalServerState>) -> u16 {
    state.https_port()
}

#[tauri::command]
pub fn local_server_token(state: tauri::State<'_, LocalServerState>) -> String {
    state.token.clone()
}

#[tauri::command]
pub fn local_ipv4_strs() -> Vec<String> {
    crate::commands::discover::discover_local_ipv4_strs()
}

#[tauri::command]
pub fn set_preferred_http_port(handle: tauri::AppHandle, port: u16) {
    crate::prefs::set_preferred_http_port(&handle, port);
}

#[tauri::command]
pub fn set_preferred_https_port(handle: tauri::AppHandle, port: u16) {
    crate::prefs::set_preferred_https_port(&handle, port);
}

#[tauri::command]
pub fn restart_server(state: tauri::State<'_, LocalServerState>) {
    state.restart();
}

// ── TCP listener binding ──────────────────────────────────────────────────────

const HTTP_PORTS: &[u16] = &[
    8080, 8180, 8280, 8380, 8480, 8580, 8680, 8780, 8880, 8980,
];
const HTTPS_PORTS: &[u16] = &[
    8043, 8143, 8243, 8343, 8443, 8543, 8643, 8743, 8843, 8943,
];

fn bind_listener(candidates: &[u16]) -> StdTcpListener {
    for &port in candidates {
        let wildcard = match StdTcpListener::bind(format!("0.0.0.0:{port}")) {
            Ok(l) => l,
            Err(e) => {
                log::debug!("local_server: port {port} bind on 0.0.0.0 failed: {e}");
                continue;
            }
        };
        match StdTcpListener::bind(format!("127.0.0.1:{port}")) {
            Ok(_) => {
                if port != candidates[0] {
                    log::info!(
                        "local_server: preferred port {pref} unavailable, bound {port} instead",
                        pref = candidates[0]
                    );
                }
                return wildcard;
            }
            Err(e) => {
                log::debug!("local_server: port {port} bind on 127.0.0.1 failed: {e}");
            }
        }
    }
    StdTcpListener::bind("0.0.0.0:0").expect("local server bind")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::TcpListener as StdTcpListener;
    use std::sync::Mutex;

    static SERIAL: Mutex<()> = Mutex::new(());

    fn grab_port() -> (StdTcpListener, u16) {
        let l = StdTcpListener::bind("0.0.0.0:0").expect("grab :0");
        let p = l.local_addr().unwrap().port();
        (l, p)
    }

    fn grab_loopback_port() -> (StdTcpListener, u16) {
        let l = StdTcpListener::bind("127.0.0.1:0").expect("grab loopback :0");
        let p = l.local_addr().unwrap().port();
        (l, p)
    }

    #[test]
    fn bind_listener_skips_wildcard_taken_candidate() {
        let _guard = SERIAL.lock().unwrap();
        let (taken_hold, taken) = grab_port();
        let candidates: Vec<u16> = (0..5).map(|i| taken.wrapping_add(i)).collect();
        let l = bind_listener(&candidates);
        let picked = l.local_addr().unwrap().port();
        assert_ne!(picked, taken, "bind_listener should skip the held port");
        assert!(
            candidates.contains(&picked),
            "picked port {picked} should be a candidate"
        );
        drop(taken_hold);
    }

    #[test]
    fn bind_listener_skips_loopback_taken_candidate() {
        let _guard = SERIAL.lock().unwrap();
        let (taken_hold, taken) = grab_loopback_port();
        let candidates: Vec<u16> = (0..5).map(|i| taken.wrapping_add(i)).collect();
        let l = bind_listener(&candidates);
        let picked = l.local_addr().unwrap().port();
        assert_ne!(
            picked, taken,
            "bind_listener should skip a port held on 127.0.0.1 (macOS coexistence quirk)"
        );
        assert!(
            candidates.contains(&picked),
            "picked port {picked} should be a candidate"
        );
        drop(taken_hold);
    }

    #[test]
    fn bind_listener_falls_back_to_os_when_all_taken() {
        let _guard = SERIAL.lock().unwrap();
        let mut held = Vec::new();
        let mut candidates = Vec::new();
        for _ in 0..8 {
            let (h, p) = grab_port();
            held.push(h);
            candidates.push(p);
        }
        let l = bind_listener(&candidates);
        let picked = l.local_addr().unwrap().port();
        assert_ne!(picked, 0, "OS-assigned port should be non-zero");
        assert!(
            !candidates.contains(&picked),
            "OS-assigned port {picked} should not collide with held range"
        );
    }

    #[test]
    fn http_and_https_ranges_do_not_overlap() {
        for &p in HTTP_PORTS {
            assert!(!HTTPS_PORTS.contains(&p), "{p} appears in both ranges");
        }
    }
}


