import { getApiBaseUrl, getApiHeaders } from './api'
import { chachaEncrypt, chachaDecrypt, arrayBufferToBitArray, bitArrayToUint8Array } from './crypto'
import { tokenToKey } from './file'
import { wrapWithReplayProtection } from './time-sync'

const TIMEOUT = 30000

export interface GqlResult<T = any> {
  data: T
  errors?: Array<{ message: string; path?: string[] }>
}

/**
 * Execute a GraphQL operation over encrypted HTTP transport.
 * Handles encryption/decryption, timeout, auth errors.
 */
export async function gqlFetch<T = any>(query: string, variables?: Record<string, any>): Promise<GqlResult<T>> {
  const url = `${getApiBaseUrl()}/graphql`
  const token = localStorage.getItem('auth_token') ?? ''
  const key = tokenToKey(token)

  const json = JSON.stringify({ query, variables })
  console.info(`[request] ${json}`)

  const startTime = performance.now()
  const payload = wrapWithReplayProtection(json)
  const body = bitArrayToUint8Array(chachaEncrypt(key, payload))
  const encryptTime = performance.now()

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { ...getApiHeaders() },
      body,
      signal: controller.signal,
    })

    if (response.status === 401) {
      localStorage.removeItem('auth_token')
      window.location.reload()
      throw new GqlError('unauthorized', 401)
    }
    if (response.status === 403) {
      throw new GqlError('web_access_disabled', 403)
    }

    const arrayBuffer = await response.arrayBuffer()
    const apiEndTime = performance.now()
    const text = chachaDecrypt(key, arrayBufferToBitArray(arrayBuffer))
    const decryptEndTime = performance.now()

    console.info(`[response] ${text}`)
    console.info(`[time] encrypt: ${encryptTime - startTime}ms, api: ${apiEndTime - encryptTime}ms, decrypt: ${decryptEndTime - apiEndTime}ms`)

    return JSON.parse(text)
  } catch (e: any) {
    if (e instanceof GqlError) throw e
    if (e.name === 'AbortError') throw new GqlError('connection_timeout')
    throw new GqlError(e.message || 'network_error')
  } finally {
    clearTimeout(timer)
  }
}

export class GqlError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message)
    this.name = 'GqlError'
  }
}
