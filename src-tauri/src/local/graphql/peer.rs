//! Peer-to-peer message delivery over HTTPS /peer_graphql.

use crate::crypto::{chacha20_decrypt, chacha20_encrypt, ed25519_sign};
use crate::local::db::{ChatDb, DChat, DPeer};
use serde_json::{json, Value};
use tokio::sync::broadcast;

use super::context::{WsEvent, WS_MESSAGE_CREATED};

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
) -> bool {
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

    let Some(encrypted) = chacha20_encrypt(key, payload.as_bytes()) else {
        return false;
    };

    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .danger_accept_invalid_hostnames(true)
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .unwrap_or_default();

    for peer_graphql_url in peer_graphql_urls {
        let mut req = client
            .post(peer_graphql_url)
            .header("c-id", client_id)
            .body(encrypted.clone());

        if let Some(cid) = channel_id {
            req = req.header("c-cid", cid);
        }

        let response = match req.send().await {
            Ok(r) => r,
            Err(e) => {
                log::warn!("local_chat: deliver_to_peer failed {peer_graphql_url}: {e}");
                continue;
            }
        };
        if !response.status().is_success() {
            log::warn!("local_chat: deliver_to_peer bad status {} from {}", response.status(), peer_graphql_url);
            continue;
        }
        let Ok(bytes) = response.bytes().await else {
            log::warn!("local_chat: deliver_to_peer failed reading response from {peer_graphql_url}");
            continue;
        };
        let Some(decrypted) = chacha20_decrypt(key, &bytes) else {
            log::warn!("local_chat: deliver_to_peer failed decrypting response from {peer_graphql_url}");
            continue;
        };
        let Ok(value) = serde_json::from_slice::<serde_json::Value>(&decrypted) else {
            log::warn!("local_chat: deliver_to_peer invalid JSON from {peer_graphql_url}");
            continue;
        };
        if value.get("errors").is_some() {
            log::warn!("local_chat: deliver_to_peer GraphQL errors from {peer_graphql_url}: {value}");
            continue;
        }
        return true;
    }
    false
}

/// Handle an incoming peer `createChatItem` message that has already been
/// authenticated and decrypted by server.rs. Bypasses the schema entirely.
pub fn create_chat_item_from_peer(
    db: &ChatDb,
    from_id: &str,
    channel_id: &str,
    content: &str,
    event_tx: &broadcast::Sender<WsEvent>,
) -> Value {
    let to_id = if channel_id.is_empty() { "me" } else { "" };
    let chat = DChat::new(from_id, to_id, channel_id, content);
    db.insert_chat(&chat);
    let item = json!({
        "id": chat.id, "fromId": chat.from_id, "toId": chat.to_id,
        "channelId": chat.channel_id, "content": chat.content,
        "createdAt": chat.created_at, "status": chat.status,
        "statusData": chat.status_data, "data": null,
    });
    let _ = event_tx.send(WsEvent {
        event_type: WS_MESSAGE_CREATED,
        payload: json!([item]).to_string(),
    });
    json!({ "data": { "createChatItem": item } })
}
