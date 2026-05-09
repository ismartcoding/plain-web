import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import router from '@/plugins/router'
import { sha512, hashToKey, chachaEncrypt, chachaDecrypt, bitArrayToUint8Array } from '@/lib/api/crypto'
import { getApiBaseUrl, getApiHeaders, getWebSocketBaseUrl, getPendingLoginHost, clearPendingLoginHost } from '@/lib/api/api'
import { getAccurateAgent } from '@/lib/agent/agent'
import { randomUUID } from '@/lib/strutil'
import { tokenToKey } from '@/lib/api/file'
import { useDeviceSessionsStore } from '@/stores/device-sessions'
import { getCurrentAuthToken } from '@/lib/device-current'
import { tauriFetch } from '@/lib/api/tauri-fetch'
import { TauriWebSocket } from '@/lib/api/tauri-ws'

function getSafeRedirect(redirect: unknown): string {
  const r = Array.isArray(redirect) ? redirect[0] : redirect
  if (typeof r === 'string' && r.startsWith('/') && !r.startsWith('//')) return r
  return '/'
}

export function useLogin() {
  const { t } = useI18n()
  const sessionsStore = useDeviceSessionsStore()
  const showError = ref(false)
  const webAccessDisabled = ref(true)
  const showConfirm = ref(false)
  const error = ref('')
  const showPasswordInput = ref(false)
  const password = ref('')
  const passwordError = ref('')
  const isSubmitting = ref(false)
  let ws: WebSocket

  async function initRequest() {
    const token = getCurrentAuthToken()
    const headers = getApiHeaders() as Record<string, string>
    let body: Uint8Array | undefined
    if (token) {
      const uuid = randomUUID()
      const key = tokenToKey(token)
      body = bitArrayToUint8Array(chachaEncrypt(key, uuid))
    }
    const initUrl = `${getApiBaseUrl()}/init`
    const r = (__IS_TAURI__ && initUrl.startsWith('https://'))
      ? await tauriFetch(initUrl, { method: 'POST', headers, body })
      : await fetch(initUrl, { method: 'POST', headers, body: body as BodyInit })
    if (r.status === 403) {
      showError.value = true; webAccessDisabled.value = true; error.value = 'web_access_disabled'; return
    }
    webAccessDisabled.value = false
    const bodyText = await r.text()
    if (r.status === 200 && token && !bodyText) {
      window.location.href = getSafeRedirect(router.currentRoute.value.query['redirect']); return
    }
    if (bodyText) { password.value = bodyText; showPasswordInput.value = false }
    else { showPasswordInput.value = true }
  }

  async function onSubmit() {
    if (!password.value?.trim()) { passwordError.value = 'valid.required'; return }
    passwordError.value = ''
    if (isSubmitting.value) return
    isSubmitting.value = true
    const clientId = localStorage.getItem('client_id')
    const pass = password.value ?? ''
    const hash = sha512(pass)
    const key = hashToKey(hash)
    error.value = ''; showError.value = false

    await new Promise<void>((resolve) => {
      const wsUrl = `${getWebSocketBaseUrl()}?cid=${clientId}&auth=1`
      ws = ((__IS_TAURI__ && wsUrl.startsWith('wss://')) ? new TauriWebSocket(wsUrl) : new WebSocket(wsUrl)) as unknown as WebSocket
      ws.onopen = async () => {
        const ua = await getAccurateAgent()
        const enc = chachaEncrypt(key, JSON.stringify({
          password: hash, browserName: ua.browser.name, browserVersion: ua.browser.version,
          osName: ua.os.name, osVersion: ua.os.version, isMobile: ua.isMobile,
        }))
        ws.send(bitArrayToUint8Array(enc) as unknown as ArrayBuffer)
      }
      ws.onmessage = async (event: MessageEvent) => {
        const d = chachaDecrypt(key, new Uint8Array(await event.data.arrayBuffer()))
        const r = JSON.parse(d)
        if (r.status === 'PENDING') { showConfirm.value = true }
        else {
          const host = getPendingLoginHost() || sessionsStore.currentSession?.host || ''
          if (host && r.clientId) {
            sessionsStore.save({ clientId: r.clientId, host, name: r.name || host, token: r.token })
            sessionsStore.setCurrent(r.clientId)
            clearPendingLoginHost()
          }
          ws.close()
          window.location.href = getSafeRedirect(router.currentRoute.value.query['redirect'])
        }
      }
      ws.onclose = async (event: CloseEvent) => {
        resolve()
        isSubmitting.value = false
        if (event.reason === 'abort' || event.reason === 'OK') return
        showError.value = true; showConfirm.value = false
        if (!event.reason) {
          const hcUrl = `${getApiBaseUrl()}/health_check`
          const hcResp = (__IS_TAURI__ && hcUrl.startsWith('https://'))
            ? await tauriFetch(hcUrl)
            : await fetch(hcUrl)
          if (hcResp.status === 200) { error.value = 'failed_connect_ws'; return }
        }
        error.value = `login.${event.reason ? event.reason : 'failed'}`
      }
      window.setTimeout(() => { if (ws.readyState !== 1) ws.close(3001, 'timeout') }, 5000)
    })
  }

  function cancel() {
    showConfirm.value = false; showError.value = false; isSubmitting.value = false; ws.close(3001, 'abort')
  }

  return {
    showError, webAccessDisabled, showConfirm, error, showPasswordInput,
    password, passwordError, isSubmitting, onSubmit, cancel, t, initRequest,
  }
}
