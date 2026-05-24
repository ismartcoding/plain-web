//! JSON serialisation helpers — DChat/DChannel/DPeer → serde_json::Value.

use crate::local::db::{DChat, DChannel, DPeer};
use serde_json::{json, Value};

pub fn chat_model(chat: &DChat) -> Value {
    json!({
        "id": chat.id,
        "fromId": chat.from_id,
        "toId": chat.to_id,
        "channelId": chat.channel_id,
        "content": chat.content,
        "createdAt": chat.created_at,
        "updatedAt": chat.updated_at,
        "data": Value::Null,
        "status": chat.status,
        "statusData": chat.status_data,
    })
}

pub fn channel_model(ch: &DChannel) -> Value {
    let members: Value = serde_json::from_str(&ch.members).unwrap_or_else(|_| json!([]));
    json!({
        "id": ch.id,
        "name": ch.name,
        "owner": ch.owner,
        "members": members,
        "version": ch.version,
        "status": ch.status,
        "createdAt": ch.created_at,
        "updatedAt": ch.updated_at,
    })
}

pub fn peer_model(p: &DPeer) -> Value {
    json!({
        "id": p.id,
        "name": p.name,
        "ip": p.ip,
        "status": p.status,
        "port": p.port,
        "deviceType": p.device_type,
        "createdAt": p.created_at,
        "updatedAt": p.updated_at,
    })
}

pub fn local_app(token: &str, port: u16, https_port: u16, device_name: &str) -> Value {
    json!({
        "usbConnected": false,
        "urlToken": token,
        "httpPort": port,
        "httpsPort": https_port,
        "appDir": "",
        "deviceName": device_name,
        "battery": "",
        "appVersion": "",
        "osVersion": "",
        "channel": "LOCAL",
        "permissions": [],
        "audios": [],
        "audioCurrent": "",
        "audioMode": "",
        "sdcardPath": "",
        "usbDiskPaths": [],
        "internalStoragePath": "",
        "downloadsDir": "",
        "developerMode": false,
        "favoriteFolders": []
    })
}
