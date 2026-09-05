import { getCurrentAuthToken } from '../device/current'
import { randomUUID } from '../strutil'
import { getApiBaseUrl, getApiHeaders } from './api'
import { chachaEncrypt, bitArrayToUint8Array } from './crypto'
import type { InitResponse } from './crypto'
import { tokenToKey } from './file'
import { tauriFetch } from './tauri-fetch'

export interface InitResult {
  status: number
  data?: InitResponse
}

/** POST /init — the only pre-login API. Optionally presents the stored
 *  token encrypted as an auto-login probe. Callers own the response
 *  triage (needsSetup routing, auto-auth, form state). */
export async function requestInit(): Promise<InitResult> {
  const headers = getApiHeaders() as Record<string, string>
  let body: Uint8Array | undefined
  const token = getCurrentAuthToken()
  if (token) {
    const key = tokenToKey(token)
    body = bitArrayToUint8Array(chachaEncrypt(key, randomUUID()))
  }
  const initUrl = `${getApiBaseUrl()}/init`
  const r = (__IS_TAURI__ && initUrl.startsWith('https://'))
    ? await tauriFetch(initUrl, { method: 'POST', headers, body })
    : await fetch(initUrl, { method: 'POST', headers, body: body as BodyInit })
  if (r.status === 403) return { status: r.status }
  const bodyText = await r.text()
  return { status: r.status, data: bodyText ? (JSON.parse(bodyText) as InitResponse) : undefined }
}
