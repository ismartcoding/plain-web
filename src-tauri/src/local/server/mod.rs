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
use std::sync::{Arc, RwLock};
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

pub struct LocalServerState {
    pub port: u16,
    pub https_port: u16,
    pub token: String,
    pub event_tx: broadcast::Sender<WsEvent>,
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
        let http_listener = bind_listener(HTTP_PORTS);
        let port = http_listener
            .local_addr()
            .expect("local server addr")
            .port();
        http_listener
            .set_nonblocking(true)
            .expect("set_nonblocking");

        let https_listener = bind_listener(HTTPS_PORTS);
        let https_port = https_listener.local_addr().expect("https addr").port();
        https_listener
            .set_nonblocking(true)
            .expect("set_nonblocking https");

        crate::prefs::set_http_port(&handle, port);
        crate::prefs::set_https_port(&handle, https_port);

        let token = crate::prefs::get_url_token(&handle);

        // Broadcast channel for WebSocket events (chat mutations → all WS clients).
        // 1024 is a generous buffer; the receiver would only "lag" (RecvError::Lagged)
        // if a single WS handler is starved for that many events in a row, which is
        // highly unlikely for chat traffic. If it does happen, we log a warning and
        // skip ahead — see `ws_handler/chat.rs`.
        let (event_tx, _) = broadcast::channel::<WsEvent>(1024);

        // Build the async-graphql schemas once; contexts are injected per-request.
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
            port,
            https_port,
            data_dir: app_data_dir.clone(),
            log_dir,
            device_name,
        });

        // Build TLS acceptor — generate self-signed cert if missing.
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

        // ── HTTP + WebSocket listener ─────────────────────────────────────────
        {
            let schema = schema.clone();
            let peer_schema = peer_schema.clone();
            let ctx = ctx.clone();
            let event_tx = event_tx.clone();
            let data_dir = app_data_dir.clone();
            let token_arc = Arc::new(token.clone());
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
            });
        }

        // ── HTTPS + WSS listener ─────────────────────────────────────────────
        if let Some(acc) = acceptor {
            let schema = schema.clone();
            let peer_schema = peer_schema.clone();
            let ctx = ctx.clone();
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
                        app_data_dir.clone(),
                    ));
                }
            });
        }

        LocalServerState {
            port,
            https_port,
            token,
            event_tx,
        }
    }
}

// ── Tauri commands ────────────────────────────────────────────────────────────

#[tauri::command]
pub fn local_server_port(state: tauri::State<'_, LocalServerState>) -> u16 {
    state.port
}

#[tauri::command]
pub fn local_server_https_port(state: tauri::State<'_, LocalServerState>) -> u16 {
    state.https_port
}

#[tauri::command]
pub fn local_server_token(state: tauri::State<'_, LocalServerState>) -> String {
    state.token.clone()
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


