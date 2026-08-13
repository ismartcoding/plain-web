import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import router from '@/plugins/router'
import { sha512, chachaEncrypt, bitArrayToUint8Array } from '@/lib/api/crypto'
import type { InitResponse } from '@/lib/api/crypto'
import { getApiBaseUrl, getApiHeaders, getPendingLoginHost, clearPendingLoginHost } from '@/lib/api/api'
import { randomUUID } from '@/lib/strutil'
import { tokenToKey } from '@/lib/api/file'
import { useDeviceSessionsStore } from '@/stores/device-sessions'
import { getCurrentAuthToken } from '@/lib/device/current'
import { tauriFetch } from '@/lib/api/tauri-fetch'
import { performLoginHandshake } from '@/lib/api/login-handshake'
import { get as prefsGet } from '@/lib/prefs'

type UseLoginOptions = {
  redirectOnSuccess?: boolean
  onSuccess?: () => void | Promise<void>
}

function getSafeRedirect(redirect: unknown): string {
  const r = Array.isArray(redirect) ? redirect[0] : redirect
  if (typeof r === 'string' && r.startsWith('/') && !r.startsWith('//')) return r
  return '/'
}

export function useLogin(options: UseLoginOptions = {}) {
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
  const redirectOnSuccess = options.redirectOnSuccess !== false
  let lastInitSignaturePublicKey = ''

  async function finishLoginSuccess() {
    if (options.onSuccess) {
      await options.onSuccess()
    }
    if (redirectOnSuccess) {
      window.location.href = getSafeRedirect(router.currentRoute.value.query['redirect'])
    }
  }

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
      showError.value = true; webAccessDisabled.value = true; error.value = 'desktop_access_disabled'; return
    }
    webAccessDisabled.value = false
    const bodyText = await r.text()
    if (r.status === 200 && token && !bodyText) {
      await finishLoginSuccess(); return
    }
    if (bodyText) {
      const initData = JSON.parse(bodyText) as InitResponse
      if (initData.signaturePublicKey) {
        lastInitSignaturePublicKey = initData.signaturePublicKey
      }
      if (initData.password) {
        password.value = initData.password
        showPasswordInput.value = false
      } else {
        showPasswordInput.value = true
      }
    } else {
      showPasswordInput.value = true
    }
  }

  async function onSubmit() {
    if (!password.value?.trim()) { passwordError.value = 'valid.required'; return }
    passwordError.value = ''
    if (isSubmitting.value) return
    isSubmitting.value = true
    showError.value = false; error.value = ''

    const hash = sha512(password.value)
    const myClientId = prefsGet('client_id', '')

    try {
      const { clientId, token, signaturePublicKey } = await performLoginHandshake({
        passwordHash: hash,
        clientId: myClientId,
        storedSignaturePublicKey: sessionsStore.currentSession?.signaturePublicKey,
        initSignaturePublicKey: lastInitSignaturePublicKey,
        onPending: () => { showConfirm.value = true },
      })

      const host = getPendingLoginHost() || sessionsStore.currentSession?.host || window.location.host || ''
      if (host && clientId) {
        sessionsStore.save({
          clientId,
          host,
          name: currentSessionName(host),
          token,
          signaturePublicKey,
        })
        sessionsStore.setCurrent(clientId)
        clearPendingLoginHost()
      }
      void finishLoginSuccess()
    } catch (e) {
      showError.value = true; showConfirm.value = false
      const reason = typeof e === 'string' ? e : ''
      if (!reason) {
        const hcUrl = `${getApiBaseUrl()}/health`
        const hcResp = (__IS_TAURI__ && hcUrl.startsWith('https://'))
          ? await tauriFetch(hcUrl)
          : await fetch(hcUrl)
        if (hcResp.status === 200) { error.value = 'failed_connect_ws'; return }
      }
      error.value = `login.${reason ? reason : 'failed'}`
    } finally {
      isSubmitting.value = false
    }
  }

  function currentSessionName(host: string): string {
    return sessionsStore.currentSession?.host === host
      ? (sessionsStore.currentSession.name || host)
      : host
  }

  function cancel() {
    showConfirm.value = false; showError.value = false; isSubmitting.value = false
  }

  return {
    showError, webAccessDisabled, showConfirm, error, showPasswordInput,
    password, passwordError, isSubmitting, onSubmit, cancel, t, initRequest,
  }
}
