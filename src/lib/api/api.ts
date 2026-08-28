import { getCurrentDeviceHost } from '../device/current'
import { get as prefsGet } from '../prefs'
import { DeviceType } from '../status'
import { applyScheme } from '../url'

export interface PendingLoginDevice {
  name: string
  host: string
  deviceType: DeviceType
}

// Temporary target device set during the login flow (before the session is committed to the store).
// Allows api.ts to route requests to the target device before clientId is known.
let _pendingLoginDevice: PendingLoginDevice | null = null

export function setPendingLoginDevice(device: PendingLoginDevice): void { _pendingLoginDevice = device }
export function clearPendingLoginDevice(): void { _pendingLoginDevice = null }
export function getPendingLoginDevice(): PendingLoginDevice | null { return _pendingLoginDevice }

// Port of the local HTTP reverse proxy (Tauri only). Initialized at app start via
// invoke('http_proxy_port'). Used by file uploads so XHR progress events work and
// WKWebView doesn't reject the self-signed device certificate.
let _httpProxyPort = 0
export function setHttpProxyPort(port: number): void { _httpProxyPort = port }

let _localServerPort = 0
export function setLocalServerPort(port: number): void { _localServerPort = port }
export function getLocalServerPort(): number { return _localServerPort }

let _localToken = ''
export function setLocalServerToken(token: string): void { _localToken = token }
export function getLocalToken(): string { return _localToken }

let _localServerHttpsPort = 0
export function setLocalServerHttpsPort(port: number): void { _localServerHttpsPort = port }
export function getLocalServerHttpsPort(): number { return _localServerHttpsPort }

/** In Tauri + HTTPS mode, builds a local proxy URL with the device target
 *  encoded as `_pt` query param — for browser-initiated requests (img/video src)
 *  that cannot set custom headers. Non-HTTPS devices get a direct URL. */
export function getProxyUrl(path: string): string {
  const base = getApiBaseUrl()
  if (__IS_TAURI__ && base.startsWith('https://')) {
    const sep = path.includes('?') ? '&' : '?'
    return `http://127.0.0.1:${_httpProxyPort}${path}${sep}_pt=${encodeURIComponent(base)}`
  }
  return `${base}${path}`
}

/** Base URL for file uploads.
 *  Tauri + HTTPS device: routes through the local HTTP proxy (self-signed cert workaround).
 *  All other cases: direct URL — caller is responsible for only invoking this for https. */
export function getUploadBaseUrl(): string {
  const base = getApiBaseUrl()
  if (__IS_TAURI__ && base.startsWith('https://')) return `http://127.0.0.1:${_httpProxyPort}`
  return base
}

export function getApiHost() {
  if (__IS_TAURI__) {
    const h = _pendingLoginDevice?.host || getCurrentDeviceHost()
    if (h) return h
  }
  return import.meta.env.VITE_APP_API_HOST || window.location.host
}

export function getApiHeaders() {
  return {
    'Content-Type': 'multipart/form-data',
    'c-id': prefsGet('client_id', ''),
  }
}

function isSecurePort(host: string): boolean {
  const m = host.match(/:(\d+)$/)
  return m ? m[1].endsWith('43') : false
}

export function getWebSocketBaseUrl() {
  if (__IS_TAURI__ && _localServerPort && !(_pendingLoginDevice || getCurrentDeviceHost())) {
    return `ws://localhost:${_localServerPort}`
  }
  if (__IS_TAURI__ && (_pendingLoginDevice || getCurrentDeviceHost())) {
    const p = isSecurePort(getApiHost()) ? 'wss' : 'ws'
    return `${p}://${getApiHost()}`
  }
  const p = window.location.protocol === 'http:' ? 'ws' : 'wss'
  return `${p}://${getApiHost()}`
}

export function getApiBaseUrl() {
  if (__IS_TAURI__ && _localServerPort && !(_pendingLoginDevice || getCurrentDeviceHost())) {
    return `http://localhost:${_localServerPort}`
  }
  if (__IS_TAURI__ && (_pendingLoginDevice || getCurrentDeviceHost())) {
    return applyScheme(isSecurePort(getApiHost()) ? 'https' : 'http', getApiHost())
  }
  return applyScheme(window.location.protocol.replace(':', ''), getApiHost())
}

export function getPhoneIp(): string {
  try {
    return new URL(`http://${getApiHost()}`).hostname
  } catch {
    return getApiHost().split(':')[0]
  }
}
