import { deviceBaseUrl, getApiHeaders } from './api'
import { chachaEncrypt, chachaDecrypt, arrayBufferToBitArray, bitArrayToUint8Array } from './crypto'
import { tokenToKey } from './file'
import { wrapWithReplayProtection } from './time-sync'
import { tauriFetch } from './tauri-fetch'
import { GqlError, type GqlResult } from './gql-client'
import type { LoginPeer } from '../device/login-peers'
import { peerHost } from '../device/login-peers'

const TIMEOUT = 30000

/**
 * POSTs a GraphQL request to a login peer's own server, encrypted with that
 * peer's login token. Local mode only — the desktop server has no proxy for
 * peer features, so the client reaches each device directly (Tauri fetch
 * accepts the devices' self-signed certificates).
 */
export async function gqlFetchPeer<T = any>(
  peer: LoginPeer,
  query: string,
  variables?: Record<string, any>,
): Promise<GqlResult<T>> {
  const url = `${deviceBaseUrl(peerHost(peer))}/graphql`
  const key = tokenToKey(peer.token)

  const body = bitArrayToUint8Array(
    chachaEncrypt(key, wrapWithReplayProtection(JSON.stringify({ query, variables }))),
  )

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT)

  try {
    const response = __IS_TAURI__
      ? await tauriFetch(url, { method: 'POST', headers: { ...getApiHeaders() } as Record<string, string>, body })
      : await fetch(url, { method: 'POST', headers: { ...getApiHeaders() }, body: body as BodyInit, signal: controller.signal })

    if (response.status === 401) throw new GqlError('unauthorized', 401)
    if (response.status === 403) throw new GqlError('desktop_access_disabled', 403)

    const arrayBuffer = await response.arrayBuffer()
    const text = chachaDecrypt(key, arrayBufferToBitArray(arrayBuffer))
    return JSON.parse(text)
  } catch (e: any) {
    if (e instanceof GqlError) throw e
    if (e.name === 'AbortError') throw new GqlError('connection_timeout')
    throw new GqlError(e.message || 'network_error')
  } finally {
    clearTimeout(timer)
  }
}
