import { invoke } from '@tauri-apps/api/core'

export interface TauriFetchResponse {
  status: number
  ok: boolean
  text(): Promise<string>
  arrayBuffer(): Promise<ArrayBuffer>
}

/**
 * Proxy fetch for Tauri builds — always routes through Rust reqwest so
 * self-signed HTTPS certificates on local devices are accepted.
 * Call only for https:// URLs; the caller decides whether to use this.
 *
 * Body and response bytes flow as raw ArrayBuffer — no base64.
 * Metadata (url, method, extra headers) travels via IPC headers.
 * First 2 bytes of the response = big-endian HTTP status code.
 */
export async function tauriFetch(
  url: string,
  options: { method?: string; headers?: Record<string, string>; body?: Uint8Array | null } = {},
): Promise<TauriFetchResponse> {
  // Build an isolated ArrayBuffer for the body so the slice is always valid.
  const rawBody: ArrayBuffer = options.body
    ? options.body.buffer.slice(options.body.byteOffset, options.body.byteOffset + options.body.byteLength) as ArrayBuffer
    : new ArrayBuffer(0)

  const raw = await invoke<ArrayBuffer>('http_request', rawBody, {
    headers: {
      'x-url': url,
      'x-method': options.method ?? 'POST',
      'x-headers': JSON.stringify(options.headers ?? {}),
    },
  })

  // First 2 bytes = big-endian HTTP status; remainder = response body.
  const status = new DataView(raw).getUint16(0)
  const body = raw.slice(2)

  return {
    status,
    ok: status >= 200 && status < 300,
    text: () => Promise.resolve(new TextDecoder().decode(body)),
    arrayBuffer: () => Promise.resolve(body),
  }
}
