import { invoke } from '@tauri-apps/api/core'

/**
 * Drop-in WebSocket replacement for Tauri builds.
 *
 * Rust binds a plain TCP WebSocket listener on 127.0.0.1:0 and returns the
 * assigned port. This class then opens a real WebSocket to that local address.
 * Rust relays frames bidirectionally to the actual device WSS URL using
 * tokio-tungstenite with danger_accept_invalid_certs — self-signed certs accepted.
 *
 * Data flows over TCP directly; no Tauri IPC serialisation is involved for
 * WebSocket frames, so throughput and latency match native WebSocket.
 */
export class TauriWebSocket {
  readyState = 0 // CONNECTING
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null

  private _ws: WebSocket | null = null
  private _clientId: string

  /**
   * @param url target WS URL. When `clientId` is given (remote-device mode)
   *   the authority part is re-resolved from the peers table right before
   *   dialing, so a device that changed IPs reconnects on its fresh address
   *   even if `url` was built from a stale login session host.
   */
  constructor(url: string, clientId = '') {
    this._clientId = clientId
    this._start(url)
  }

  private async _start(url: string): Promise<void> {
    try {
      const targetUrl = await this._resolveUrl(url)
      const port = await invoke<number>('ws_start_proxy', { url: targetUrl })
      const ws = new WebSocket(`ws://127.0.0.1:${port}`)
      this._ws = ws
      ws.onopen = (e) => {
        console.error('[tauri-ws] inner WS onopen readyState=', ws.readyState)
        this.readyState = 1
        this.onopen?.(e)
      }
      ws.onmessage = (e) => {
        this.onmessage?.(e)
      }
      ws.onclose = (e) => {
        console.error('[tauri-ws] inner WS onclose code=', e.code, 'reason=', e.reason, 'wasClean=', e.wasClean)
        this.readyState = 3
        this.onclose?.(e)
      }
      ws.onerror = (e) => {
        console.error('[tauri-ws] inner WS onerror', e, 'readyState=', ws.readyState)
        this.onerror?.(e)
      }
    } catch {
      this.readyState = 3
      this.onerror?.(new Event('error'))
      this.onclose?.(new CloseEvent('close', { wasClean: false, code: 1006 }))
    }
  }

  /** Replaces the URL's authority with the peer's current `ip:port` from the
   *  peers table (kept fresh by the resident mDNS listener). No-op when the
   *  peer is unknown — dialing the original URL is then the only option. */
  private async _resolveUrl(url: string): Promise<string> {
    if (!this._clientId) return url
    try {
      const host = await invoke<string | null>('peer_address', { id: this._clientId })
      if (!host || host === new URL(url).host) return url
      console.error('[tauri-ws] resolve', this._clientId, ':', new URL(url).host, '->', host)
      return url.replace(/:\/\/[^/]+/, `://${host}`)
    } catch {
      return url
    }
  }

  send(data: ArrayBuffer | Uint8Array): void {
    if (!this._ws) return
    // Normalise Uint8Array with non-standard buffer type to a plain ArrayBuffer.
    const buf: BufferSource = data instanceof Uint8Array
      ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
      : data
    this._ws.send(buf)
  }

  close(code?: number, reason?: string): void {
    this.readyState = 3
    if (this._ws) {
      this._ws.close(code, reason)
    } else {
      // _start failed before _ws was assigned; fire onclose so callers can clean up
      this.onclose?.(new CloseEvent('close', { wasClean: false, code: code ?? 1000, reason: reason ?? '' }))
    }
  }
}

