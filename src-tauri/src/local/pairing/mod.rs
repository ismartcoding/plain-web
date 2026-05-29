//! Peer-pairing protocol — mirrors plain-app `NearbyPairManager`.
//!
//! The pairing handshake:
//!   Initiator → Target : `PAIR_REQUEST:{json}`  (UDP unicast to Target's IP:52352)
//!   Target   → Initiator: `PAIR_RESPONSE:{json}` (UDP unicast)
//!   Either   → Other    : `PAIR_CANCEL:{json}`   (abort)
//!
//! Security:
//!   - ECDH P-256 ephemeral key exchange; 32-byte raw shared secret = XChaCha20 key.
//!   - Ed25519 signatures on canonical string to prevent MITM.
//!   - Timestamp in payload (±5 min) prevents replay attacks.
//!
//! After a successful handshake the peer is written to the `peers` table and the
//! ChatDb's key-cache is considered stale (callers should re-query `get_peers`).

use super::db::{now_iso, ChatDb, DPeer};
use crate::crypto::{base64_decode, base64_encode, ed25519_sign, ed25519_verify, EcdhSession};
use crate::prefs::AppIdentity;
use serde::Serialize;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Duration;

pub mod commands;
mod protocol;
mod utils;

pub use protocol::{PairingCancel, PairingRequest, PairingResponse};

use utils::{
    bind_pairing_socket, device_type_signature_value, local_ipv4_strs, now_ms, prefer_sender_ip,
    send_udp, timestamp_ok, NEARBY_PORT,
};

const PAIR_REQUEST_PREFIX: &str = "PAIR_REQUEST:";
const PAIR_RESPONSE_PREFIX: &str = "PAIR_RESPONSE:";
const PAIR_CANCEL_PREFIX: &str = "PAIR_CANCEL:";
const LOCAL_DEVICE_TYPE_WIRE: &str = "COMPUTER";

// ── Internal session state ────────────────────────────────────────────────────

#[allow(dead_code)]
struct PairingSession {
    device_id: String,
    device_name: String,
    device_ip: String,
    /// Ephemeral ECDH session.  Consumed when shared key is derived.
    ecdh: Option<EcdhSession>,
    created_at_ms: i64,
}

// ── Pairing manager ───────────────────────────────────────────────────────────

#[derive(Clone)]
pub struct PairingManager {
    pub db: Arc<ChatDb>,
    pub identity: Arc<AppIdentity>,
    sessions: Arc<Mutex<HashMap<String, PairingSession>>>,
    /// Broadcast channel to notify the frontend of pairing events.
    event_tx: tokio::sync::broadcast::Sender<PairingEvent>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PairingEvent {
    pub kind: PairingEventKind,
    pub device_id: String,
    pub device_name: String,
}

#[derive(Serialize, Clone, Debug)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum PairingEventKind {
    /// Incoming PAIR_REQUEST that the user must accept or reject.
    #[serde(rename_all = "camelCase")]
    IncomingRequest {
        request: PairingRequest,
        sender_ip: String,
    },
    /// Pairing completed successfully.
    Success,
    /// Pairing failed or was rejected.
    #[serde(rename_all = "camelCase")]
    Failed { reason: String },
    /// Remote cancelled pairing.
    Cancelled,
}

impl PairingManager {
    pub fn new(
        db: Arc<ChatDb>,
        identity: Arc<AppIdentity>,
    ) -> (Self, tokio::sync::broadcast::Receiver<PairingEvent>) {
        let (tx, rx) = tokio::sync::broadcast::channel(32);
        let mgr = PairingManager {
            db,
            identity,
            sessions: Arc::new(Mutex::new(HashMap::new())),
            event_tx: tx,
        };
        (mgr, rx)
    }

    fn dispatch(&self, msg: &str, sender_ip: &str) {
        if let Some(payload) = msg.strip_prefix(PAIR_REQUEST_PREFIX) {
            match serde_json::from_str::<PairingRequest>(payload) {
                Ok(req) => self.on_pair_request(req, sender_ip),
                Err(e) => log::debug!("local_pairing: bad PAIR_REQUEST: {e}"),
            }
        } else if let Some(payload) = msg.strip_prefix(PAIR_RESPONSE_PREFIX) {
            match serde_json::from_str::<PairingResponse>(payload) {
                Ok(resp) => self.on_pair_response(resp, sender_ip),
                Err(e) => log::debug!("local_pairing: bad PAIR_RESPONSE: {e}"),
            }
        } else if let Some(payload) = msg.strip_prefix(PAIR_CANCEL_PREFIX) {
            match serde_json::from_str::<PairingCancel>(payload) {
                Ok(cancel) => self.on_pair_cancel(cancel),
                Err(e) => log::debug!("local_pairing: bad PAIR_CANCEL: {e}"),
            }
        }
    }

    // ── Initiator side ────────────────────────────────────────────────────────

    /// Send a PAIR_REQUEST and wait up to ~30s for the matching PAIR_RESPONSE.
    /// Binds UDP port 52352 only during the pairing window (plain-app sends
    /// the response back to that port, not to the source port). Returns when
    /// the response arrives, the user cancels, or the timeout elapses.
    pub fn start_pairing(
        &self,
        device_id: &str,
        device_name: &str,
        device_ip: &str,
        local_port: u16,
    ) {
        let identity = &self.identity;
        let ecdh = EcdhSession::generate();
        let ecdh_pub_b64 = base64_encode(&ecdh.public_key_bytes);
        let kp_bytes = base64_decode(&identity.ed25519_keypair);
        let vk_bytes = if kp_bytes.len() == 64 {
            kp_bytes[32..].to_vec()
        } else {
            vec![]
        };
        let sig_pub_b64 = base64_encode(&vk_bytes);

        let ts = now_ms();
        let local_ips = local_ipv4_strs();
        let mut req = PairingRequest {
            from_id: identity.client_id.clone(),
            from_name: identity.device_name.clone(),
            port: local_port,
            device_type: LOCAL_DEVICE_TYPE_WIRE.to_string(),
            ecdh_public_key: ecdh_pub_b64,
            signature_public_key: sig_pub_b64,
            timestamp: ts,
            ips: local_ips,
            signature: String::new(),
        };
        req.signature = ed25519_sign(&kp_bytes, req.signature_data().as_bytes());

        {
            let mut sessions = self.sessions.lock().unwrap();
            sessions.insert(
                device_id.to_string(),
                PairingSession {
                    device_id: device_id.to_string(),
                    device_name: device_name.to_string(),
                    device_ip: device_ip.to_string(),
                    ecdh: Some(ecdh),
                    created_at_ms: ts,
                },
            );
        }

        let msg = format!(
            "{}{}",
            PAIR_REQUEST_PREFIX,
            serde_json::to_string(&req).unwrap_or_default()
        );
        let device_ip = device_ip.to_string();
        let device_id = device_id.to_string();
        let device_name = device_name.to_string();
        let mgr = self.clone();

        // Run send + receive on a blocking worker so we don't block the IPC
        // thread. The socket lives only for the pairing window.
        tauri::async_runtime::spawn_blocking(move || {
            let socket = match bind_pairing_socket() {
                Ok(s) => s,
                Err(e) => {
                    log::error!(
                        "local_pairing: failed to bind {NEARBY_PORT} for pairing after retry: {e}"
                    );
                    let _ = mgr.event_tx.send(PairingEvent {
                        kind: PairingEventKind::Failed {
                            reason: format!("bind UDP {NEARBY_PORT} failed: {e}"),
                        },
                        device_id: device_id.clone(),
                        device_name: device_name.clone(),
                    });
                    mgr.sessions.lock().unwrap().remove(&device_id);
                    return;
                }
            };
            let _ = socket.set_read_timeout(Some(Duration::from_millis(500)));
            // Send PAIR_REQUEST.
            let target = format!("{device_ip}:{NEARBY_PORT}");
            if let Err(e) = socket.send_to(msg.as_bytes(), &target) {
                log::error!("local_pairing: send PAIR_REQUEST failed: {e}");
                let _ = mgr.event_tx.send(PairingEvent {
                    kind: PairingEventKind::Failed {
                        reason: format!("send PAIR_REQUEST failed: {e}"),
                    },
                    device_id: device_id.clone(),
                    device_name: device_name.clone(),
                });
                mgr.sessions.lock().unwrap().remove(&device_id);
                return;
            }
            // Loop receive until response/cancel/timeout (~30s budget).
            let deadline = std::time::Instant::now() + Duration::from_secs(30);
            let mut buf = [0u8; 4096];
            while std::time::Instant::now() < deadline {
                // Bail if the session was cancelled by the user.
                if !mgr.sessions.lock().unwrap().contains_key(&device_id) {
                    return;
                }
                match socket.recv_from(&mut buf) {
                    Ok((n, src)) => {
                        let s = match std::str::from_utf8(&buf[..n]) {
                            Ok(s) => s,
                            Err(_) => continue,
                        };
                        let sender_ip = match src.ip() {
                            std::net::IpAddr::V4(v4) => v4.to_string(),
                            _ => continue,
                        };
                        mgr.dispatch(s, &sender_ip);
                        // dispatch consumed the session on success/failure.
                        if !mgr.sessions.lock().unwrap().contains_key(&device_id) {
                            return;
                        }
                    }
                    Err(ref e)
                        if e.kind() == std::io::ErrorKind::WouldBlock
                            || e.kind() == std::io::ErrorKind::TimedOut =>
                    {
                        continue
                    }
                    Err(e) => {
                        log::debug!("local_pairing: recv error: {e}");
                        break;
                    }
                }
            }
            // Timed out.
            if mgr.sessions.lock().unwrap().remove(&device_id).is_some() {
                let _ = mgr.event_tx.send(PairingEvent {
                    kind: PairingEventKind::Failed {
                        reason: "Pairing timed out".to_string(),
                    },
                    device_id,
                    device_name,
                });
            }
        });
    }

    // ── Responder side ────────────────────────────────────────────────────────

    /// Incoming PAIR_REQUEST from a remote device.  Emits `IncomingRequest` event;
    /// the frontend calls `respond_to_pairing(request_json, accepted)` to reply.
    fn on_pair_request(&self, req: PairingRequest, sender_ip: &str) {
        if !timestamp_ok(req.timestamp) {
            log::warn!("local_pairing: PAIR_REQUEST timestamp out of range");
            return;
        }
        if !ed25519_verify(
            &req.signature_public_key,
            req.signature_data().as_bytes(),
            &req.signature,
        ) {
            log::warn!("local_pairing: PAIR_REQUEST signature invalid");
            return;
        }
        let _ = self.event_tx.send(PairingEvent {
            kind: PairingEventKind::IncomingRequest {
                request: req.clone(),
                sender_ip: sender_ip.to_string(),
            },
            device_id: req.from_id.clone(),
            device_name: req.from_name.clone(),
        });
    }

    /// Called from frontend after user accepts/rejects a pairing request.
    pub fn respond_to_pairing(
        &self,
        request: PairingRequest,
        sender_ip: &str,
        accepted: bool,
        local_port: u16,
    ) {
        let identity = &self.identity;
        let kp_bytes = base64_decode(&identity.ed25519_keypair);
        let vk_bytes = if kp_bytes.len() == 64 {
            kp_bytes[32..].to_vec()
        } else {
            vec![]
        };
        let sig_pub_b64 = base64_encode(&vk_bytes);
        let ts = now_ms();

        if accepted {
            let ecdh = EcdhSession::generate();
            let ecdh_pub_b64 = base64_encode(&ecdh.public_key_bytes);

            let mut resp = PairingResponse {
                from_id: identity.client_id.clone(),
                to_id: request.from_id.clone(),
                port: local_port,
                device_type: LOCAL_DEVICE_TYPE_WIRE.to_string(),
                ecdh_public_key: ecdh_pub_b64,
                signature_public_key: sig_pub_b64,
                accepted: true,
                timestamp: ts,
                ips: local_ipv4_strs(),
                signature: String::new(),
            };
            resp.signature = ed25519_sign(&kp_bytes, resp.signature_data().as_bytes());

            let req_pub_bytes = base64_decode(&request.ecdh_public_key);
            if let Some(shared) = ecdh.compute_shared_key(&req_pub_bytes) {
                let peer_ips = prefer_sender_ip(&request.ips, sender_ip);
                let peer = DPeer {
                    id: request.from_id.clone(),
                    name: request.from_name.clone(),
                    ip: peer_ips,
                    key: base64_encode(&shared),
                    public_key: request.signature_public_key.clone(),
                    status: "paired".to_string(),
                    port: request.port,
                    device_type: device_type_signature_value(&request.device_type),
                    created_at: now_iso(),
                    updated_at: now_iso(),
                };
                self.db.upsert_peer(&peer);
                let msg = format!(
                    "{}{}",
                    PAIR_RESPONSE_PREFIX,
                    serde_json::to_string(&resp).unwrap_or_default()
                );
                send_udp(&msg, sender_ip, NEARBY_PORT);
                let _ = self.event_tx.send(PairingEvent {
                    kind: PairingEventKind::Success,
                    device_id: request.from_id.clone(),
                    device_name: request.from_name.clone(),
                });
            } else {
                log::error!("local_pairing: ECDH shared key computation failed");
            }
        } else {
            let mut resp = PairingResponse {
                from_id: identity.client_id.clone(),
                to_id: request.from_id.clone(),
                port: local_port,
                device_type: LOCAL_DEVICE_TYPE_WIRE.to_string(),
                ecdh_public_key: String::new(),
                signature_public_key: sig_pub_b64,
                accepted: false,
                timestamp: ts,
                ips: vec![],
                signature: String::new(),
            };
            resp.signature = ed25519_sign(&kp_bytes, resp.signature_data().as_bytes());
            let msg = format!(
                "{}{}",
                PAIR_RESPONSE_PREFIX,
                serde_json::to_string(&resp).unwrap_or_default()
            );
            send_udp(&msg, sender_ip, NEARBY_PORT);
        }
    }

    // ── Initiator receives response ───────────────────────────────────────────

    fn on_pair_response(&self, resp: PairingResponse, sender_ip: &str) {
        if !timestamp_ok(resp.timestamp) {
            log::warn!("local_pairing: PAIR_RESPONSE timestamp out of range");
            return;
        }
        if !ed25519_verify(
            &resp.signature_public_key,
            resp.signature_data().as_bytes(),
            &resp.signature,
        ) {
            log::warn!("local_pairing: PAIR_RESPONSE signature invalid");
            return;
        }

        let session = {
            let mut sessions = self.sessions.lock().unwrap();
            sessions.remove(&resp.from_id)
        };

        let Some(session) = session else {
            log::debug!(
                "local_pairing: no session for PAIR_RESPONSE from {}",
                resp.from_id
            );
            return;
        };

        if !resp.accepted {
            let _ = self.event_tx.send(PairingEvent {
                kind: PairingEventKind::Failed {
                    reason: "Pairing request was rejected".to_string(),
                },
                device_id: resp.from_id.clone(),
                device_name: session.device_name.clone(),
            });
            return;
        }

        let Some(ecdh) = session.ecdh else {
            log::error!("local_pairing: session ECDH already consumed");
            return;
        };
        let resp_pub_bytes = base64_decode(&resp.ecdh_public_key);
        let Some(shared) = ecdh.compute_shared_key(&resp_pub_bytes) else {
            let _ = self.event_tx.send(PairingEvent {
                kind: PairingEventKind::Failed {
                    reason: "ECDH key computation failed".to_string(),
                },
                device_id: resp.from_id.clone(),
                device_name: session.device_name.clone(),
            });
            return;
        };

        let peer_ips = prefer_sender_ip(&resp.ips, sender_ip);
        let peer = DPeer {
            id: resp.from_id.clone(),
            name: session.device_name.clone(),
            ip: peer_ips,
            key: base64_encode(&shared),
            public_key: resp.signature_public_key.clone(),
            status: "paired".to_string(),
            port: resp.port,
            device_type: device_type_signature_value(&resp.device_type),
            created_at: now_iso(),
            updated_at: now_iso(),
        };
        self.db.upsert_peer(&peer);
        let _ = self.event_tx.send(PairingEvent {
            kind: PairingEventKind::Success,
            device_id: resp.from_id.clone(),
            device_name: session.device_name.clone(),
        });
    }

    fn on_pair_cancel(&self, cancel: PairingCancel) {
        {
            let mut sessions = self.sessions.lock().unwrap();
            sessions.remove(&cancel.from_id);
        }
        let _ = self.event_tx.send(PairingEvent {
            kind: PairingEventKind::Cancelled,
            device_id: cancel.from_id.clone(),
            device_name: String::new(),
        });
    }

    /// Cancel an in-progress pairing session (initiated by us).
    pub fn cancel_pairing(&self, device_id: &str) {
        let session = {
            let mut sessions = self.sessions.lock().unwrap();
            sessions.remove(device_id)
        };
        if let Some(s) = session {
            let cancel = PairingCancel {
                from_id: self.identity.client_id.clone(),
                to_id: device_id.to_string(),
            };
            let msg = format!(
                "{}{}",
                PAIR_CANCEL_PREFIX,
                serde_json::to_string(&cancel).unwrap_or_default()
            );
            send_udp(&msg, &s.device_ip, NEARBY_PORT);
        }
    }
}
