use super::protocol::PairingRequest;
use super::PairingManager;

/// Initiate pairing with a discovered device.
#[tauri::command]
pub fn pair_device(
    device_id: String,
    device_name: String,
    device_ip: String,
    state: tauri::State<'_, PairingManager>,
    server_state: tauri::State<'_, super::super::server::LocalServerState>,
) {
    state.start_pairing(&device_id, &device_name, &device_ip, server_state.https_port);
}

/// Accept or reject an incoming PAIR_REQUEST.
/// `request_json` is the JSON-serialised `PairingRequest` from the `IncomingRequest` event.
#[tauri::command]
pub fn respond_pair_device(
    request_json: String,
    sender_ip: String,
    accepted: bool,
    state: tauri::State<'_, PairingManager>,
    server_state: tauri::State<'_, super::super::server::LocalServerState>,
) -> Result<(), String> {
    let req: PairingRequest =
        serde_json::from_str(&request_json).map_err(|e| e.to_string())?;
    state.respond_to_pairing(req, &sender_ip, accepted, server_state.https_port);
    Ok(())
}

/// Cancel an in-progress pairing initiated by us.
#[tauri::command]
pub fn cancel_pair_device(
    device_id: String,
    state: tauri::State<'_, PairingManager>,
) {
    state.cancel_pairing(&device_id);
}

/// Return the local device's identity (client_id, device_name, public key).
#[tauri::command]
pub fn get_device_identity(state: tauri::State<'_, PairingManager>) -> serde_json::Value {
    let identity = &state.identity;
    let kp = crate::crypto::base64_decode(&identity.ed25519_keypair);
    let pub_key_b64 = if kp.len() == 64 {
        crate::crypto::base64_encode(&kp[32..])
    } else {
        String::new()
    };
    serde_json::json!({
        "clientId": identity.client_id,
        "deviceName": identity.device_name,
        "publicKey": pub_key_b64,
    })
}

/// Update the local device's display name.
#[tauri::command]
pub fn set_device_name(name: String, app: tauri::AppHandle) {
    crate::prefs::set_device_name(&app, &name);
}
