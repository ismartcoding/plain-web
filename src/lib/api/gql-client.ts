import { getApiBaseUrl, getApiHeaders, getLocalToken } from './api'
import { chachaEncrypt, chachaDecrypt, arrayBufferToBitArray, bitArrayToUint8Array } from './crypto'
import { tokenToKey } from './file'
import { wrapWithReplayProtection } from './time-sync'
import { getCurrentAuthToken, clearCurrentSession } from '../device/current'
import { tauriFetch } from './tauri-fetch'
import { isLocalMode } from '../device/local-mode'

const TIMEOUT = 30000

export interface GqlResult<T = any> {
  data: T
  errors?: Array<{ message: string; path?: string[] }>
}

// Deduplicate concurrent identical requests (same query + variables).
// If an identical request is already in-flight, callers share the same promise.
const pendingRequests = new Map<string, Promise<GqlResult<any>>>()

export interface GqlFetchOptions {
  dedupe?: boolean
  fresh?: boolean
}

export async function gqlFetch<T = any>(
  query: string,
  variables?: Record<string, any>,
  options: GqlFetchOptions = {},
): Promise<GqlResult<T>> {
  const dedupeKey = JSON.stringify({ query, variables })
  if (options.dedupe !== false && !options.fresh) {
    const pending = pendingRequests.get(dedupeKey)
    if (pending) return pending as Promise<GqlResult<T>>
  }

  const promise = doGqlFetch<T>(query, variables)
  if (options.dedupe !== false) pendingRequests.set(dedupeKey, promise)
  try {
    return await promise
  } finally {
    if (pendingRequests.get(dedupeKey) === promise) pendingRequests.delete(dedupeKey)
  }
}

async function doGqlFetch<T = any>(query: string, variables?: Record<string, any>): Promise<GqlResult<T>> {
  const url = `${getApiBaseUrl()}/graphql`
  const token = isLocalMode() ? getLocalToken() : getCurrentAuthToken()
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
    const response = (__IS_TAURI__ && url.startsWith('https://'))
      ? await tauriFetch(url, { method: 'POST', headers: { ...getApiHeaders() } as Record<string, string>, body })
      : await fetch(url, { method: 'POST', headers: { ...getApiHeaders() }, body: body as BodyInit, signal: controller.signal })

    if (response.status === 401) {
      // In local mode there is no device session — never clear state or reload;
      // that would create an infinite reload loop.
      if (!__IS_TAURI__) {
        clearCurrentSession()
        window.location.reload()
      }
      throw new GqlError('unauthorized', 401)
    } else if (response.status === 403) {
      throw new GqlError('desktop_access_disabled', 403)
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
