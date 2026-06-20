/**
 * Wire shapes for plain-app's pairing WebSocket events. Must match
 * plain-app's `data/DNearbyPair.kt` — see
 * `app/src/main/java/com/ismartcoding/plain/data/DNearbyPair.kt`.
 *
 * The browser sees two distinct payload shapes depending on the event:
 * - `PAIRING_REQUEST_RECEIVED(22)` → raw `DPairingRequest` JSON
 * - `PAIRING_SUCCESS(23)` / `PAIRING_FAILED(24)` / `PAIRING_CANCELED(25)` →
 *   flat `DPairingResult` JSON: `{ deviceId, deviceName, error }`
 */

export interface PairingRequest {
  fromId: string
  fromName: string
  port: number
  deviceType: string
  ecdhPublicKey: string
  signaturePublicKey: string
  timestamp: number
  ips: string[]
  signature: string
  /** Plain-app-only field: the requester's IP. Missing on plain-web's local
   * Rust server, so we keep it optional for cross-server compatibility. */
  fromIp?: string
}

export interface PairingResult {
  deviceId: string
  deviceName: string
  /** Empty string for `success` / `cancelled`; human-readable reason for `failed`. */
  error: string
}
