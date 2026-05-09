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

  constructor(url: string) {
    this._start(url)
  }

  private async _start(url: string): Promise<void> {
    try {
      const port = await invoke<number>('ws_start_proxy', { url })
      const ws = new WebSocket(`ws://127.0.0.1:${port}`)
      this._ws = ws
      ws.onopen = (e) => {
        this.readyState = 1
        this.onopen?.(e)
      }
      ws.onmessage = (e) => this.onmessage?.(e)
      ws.onclose = (e) => {
        this.readyState = 3
        this.onclose?.(e)
      }
      ws.onerror = (e) => this.onerror?.(e)
    } catch {
      this.readyState = 3
      this.onerror?.(new Event('error'))
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
    this._ws?.close(code, reason)
  }
}

