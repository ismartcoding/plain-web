//! Outgoing peer-to-peer message delivery over HTTPS `/peer_graphql`.
//!
//! The incoming side (decryption, signature verification, mutation
//! dispatch) lives in `crate::local::peer_graphql`.

use crate::crypto::{xchacha_decrypt_raw, xchacha_encrypt_raw, ed25519_sign, ed25519_verify};
use crate::local::db::DPeer;
use serde_json::json;

fn reqwest_error_kind(err: &reqwest::Error) -> &'static str {
    if err.is_timeout() {
        "timeout"
    } else if err.is_connect() {
        "connect"
    } else if err.is_request() {
        "request"
    } else if err.is_body() {
        "body"
    } else if err.is_decode() {
        "decode"
    } else if err.is_status() {
        "status"
    } else {
        "unknown"
    }
}

fn error_source_chain(err: &dyn std::error::Error) -> String {
    let mut parts = Vec::new();
    let mut current = err.source();
    while let Some(source) = current {
        parts.push(source.to_string());
        current = source.source();
    }

    if parts.is_empty() {
        "<none>".to_string()
    } else {
        parts.join(" -> ")
    }
}

/// Build all candidate URLs for a peer's /peer_graphql endpoint,
/// ordered with the most-recently-seen IP first.
pub fn peer_graphql_urls(peer: &DPeer) -> Vec<String> {
    peer.ip
        .split(',')
        .map(str::trim)
        .filter(|ip| !ip.is_empty())
        .map(|ip| format!("https://{}:{}/peer_graphql", ip, peer.port))
        .collect()
}

/// POST a `createChatItem` GraphQL request to `peer_graphql_urls`, trying each
/// URL in order and returning `true` on the first successful delivery.
/// Payload format: ChaCha20-Poly1305(signature|timestamp|GraphQL_JSON)
pub async fn deliver_to_peer(
    peer_graphql_urls: &[String],
    key: &[u8],
    client_id: &str,
    kp_bytes: &[u8],
    content: &str,
    channel_id: Option<&str>,
) -> Result<(), String> {
    use std::time::{SystemTime, UNIX_EPOCH};

    let graphql_json = serde_json::to_string(&json!({
        "query": "mutation CreateChatItem($content: String!) { createChatItem(content: $content) { id fromId toId createdAt } }",
        "variables": { "content": content }
    }))
    .unwrap_or_default();

    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64;

    let sig_data = format!("{ts}{graphql_json}");
    let signature = ed25519_sign(kp_bytes, sig_data.as_bytes());
    let payload = format!("{signature}|{ts}|{graphql_json}");

    let Some(encrypted) = xchacha_encrypt_raw(key, payload.as_bytes()) else {
        return Err("encrypt failed".to_string());
    };

    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .danger_accept_invalid_hostnames(true)
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .unwrap_or_default();

    let mut errors = Vec::new();

    for peer_graphql_url in peer_graphql_urls {
        let mut req = client
            .post(peer_graphql_url)
            .header("c-id", client_id)
            .header(reqwest::header::CONTENT_TYPE, "application/octet-stream")
            .body(encrypted.clone());

        if let Some(cid) = channel_id {
            req = req.header("c-cid", cid);
        }

        let response = match req.send().await {
            Ok(r) => r,
            Err(e) => {
                let error_message = format!(
                    "request failed kind={} error={} sources={}",
                    reqwest_error_kind(&e),
                    e,
                    error_source_chain(&e)
                );
                log::warn!(
                    "local_chat: deliver_to_peer request failed url={} kind={} timeout={} connect={} status={} body={} decode={} request={} error={} sources={}",
                    peer_graphql_url,
                    reqwest_error_kind(&e),
                    e.is_timeout(),
                    e.is_connect(),
                    e.is_status(),
                    e.is_body(),
                    e.is_decode(),
                    e.is_request(),
                    e,
                    error_source_chain(&e)
                );
                errors.push(format!("{}: {}", peer_graphql_url, error_message));
                continue;
            }
        };
        if !response.status().is_success() {
            let status = response.status();
            let body_text = match response.text().await {
                Ok(text) => text,
                Err(err) => format!("<failed to read body: {}>", err),
            };
            log::warn!(
                "local_chat: deliver_to_peer bad status {} from {} c-id={} body={}",
                status,
                peer_graphql_url,
                client_id,
                body_text
            );
            errors.push(format!(
                "{}: HTTP {}{}",
                peer_graphql_url,
                status,
                if body_text.is_empty() {
                    String::new()
                } else {
                    format!(" body={}", body_text)
                }
            ));
            continue;
        }
        let Ok(bytes) = response.bytes().await else {
            log::warn!(
                "local_chat: deliver_to_peer failed reading response from {peer_graphql_url}"
            );
            errors.push(format!("{}: failed reading response", peer_graphql_url));
            continue;
        };
        let Some(decrypted) = xchacha_decrypt_raw(key, &bytes) else {
            log::warn!(
                "local_chat: deliver_to_peer failed decrypting response from {peer_graphql_url}"
            );
            errors.push(format!("{}: failed decrypting response", peer_graphql_url));
            continue;
        };
        let Ok(value) = serde_json::from_slice::<serde_json::Value>(&decrypted) else {
            log::warn!("local_chat: deliver_to_peer invalid JSON from {peer_graphql_url}");
            errors.push(format!("{}: invalid JSON response", peer_graphql_url));
            continue;
        };
        if value.get("errors").is_some() {
            log::warn!(
                "local_chat: deliver_to_peer GraphQL errors from {peer_graphql_url}: {value}"
            );
            errors.push(format!("{}: GraphQL errors {}", peer_graphql_url, value));
            continue;
        }
        return Ok(());
    }

    Err(if errors.is_empty() {
        "delivery failed".to_string()
    } else {
        errors.join("; ")
    })
}

/// Send a `channelSystemMessage` GraphQL mutation to a peer over the same
/// transport used by `deliver_to_peer`. Returns `true` if the peer
/// acknowledged the request, `false` otherwise.
///
/// When `channel_id_opt` is `Some`, the request carries a `c-cid`
/// header so the receiver picks the channel key from its cache
/// instead of the peer's shared key. The wire body is still
/// encrypted with `key` — callers are responsible for passing the
/// correct key (channel key when `channel_id_opt.is_some()`,
/// otherwise the peer's shared key).
#[allow(dead_code)]
pub async fn deliver_channel_system_message(
    peer: &DPeer,
    key: &[u8],
    client_id: &str,
    kp_bytes: &[u8],
    msg_type: &str,
    payload: &str,
    channel_id_opt: Option<&str>,
) -> bool {
    use std::time::{SystemTime, UNIX_EPOCH};

    let graphql_json = serde_json::to_string(&json!({
        "query": "mutation ChannelSystemMessage($type: ChannelSystemMessageType!, $payload: String!) { channelSystemMessage(type: $type, payload: $payload) }",
        "variables": { "type": msg_type, "payload": payload }
    }))
    .unwrap_or_default();

    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64;
    let sig_data = format!("{ts}{graphql_json}");
    let signature = ed25519_sign(kp_bytes, sig_data.as_bytes());
    let wire = format!("{signature}|{ts}|{graphql_json}");

    let Some(encrypted) = xchacha_encrypt_raw(key, wire.as_bytes()) else {
        log::warn!("[channel] encrypt failed for {} ({msg_type})", peer.id);
        return false;
    };

    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .danger_accept_invalid_hostnames(true)
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .unwrap_or_default();

    for url in peer_graphql_urls(peer) {
        let mut req = client
            .post(&url)
            .header("c-id", client_id)
            .header(reqwest::header::CONTENT_TYPE, "application/octet-stream")
            .body(encrypted.clone());
        if let Some(cid) = channel_id_opt
            && !cid.is_empty()
        {
            req = req.header("c-cid", cid);
        }
        let resp = req.send().await;
        let Ok(resp) = resp else { continue };
        if !resp.status().is_success() {
            log::warn!(
                "[channel] {} bad status {} from {}",
                msg_type,
                resp.status(),
                url
            );
            continue;
        }
        let Ok(bytes) = resp.bytes().await else {
            continue;
        };
        let Some(decrypted) = xchacha_decrypt_raw(key, &bytes) else {
            log::warn!("[channel] {} response decrypt failed from {url}", msg_type);
            continue;
        };
        let Ok(value) = serde_json::from_slice::<serde_json::Value>(&decrypted) else {
            continue;
        };
        if value.get("errors").is_some() {
            log::warn!("[channel] {} GraphQL errors from {url}: {value}", msg_type);
            continue;
        }
        log::debug!("[channel] {} sent to {} via {url}", msg_type, peer.id);
        return true;
    }
    log::debug!(
        "[channel] {} delivery failed to {} (no reachable URL)",
        msg_type,
        peer.id
    );
    false
}

/// Verify an incoming peer message's Ed25519 signature. Currently a thin
/// wrapper over `ed25519_verify`; exposed so the http handler can validate
/// the signature before dispatching to a sub-handler.
#[allow(dead_code)]
pub fn verify_peer_signature(public_key_b64: &str, sig_data: &[u8], sig_b64: &str) -> bool {
    ed25519_verify(public_key_b64, sig_data, sig_b64)
}
