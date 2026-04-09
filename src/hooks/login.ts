import { ref } from 'vue'
import { useField, useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { z } from 'zod'
import { useI18n } from 'vue-i18n'
import router from '@/plugins/router'
import { sha512, hashToKey, chachaEncrypt, chachaDecrypt, bitArrayToUint8Array } from '@/lib/api/crypto'
import { getApiBaseUrl, getApiHeaders, getWebSocketBaseUrl } from '@/lib/api/api'
import { getAccurateAgent } from '@/lib/agent/agent'
import { randomUUID } from '@/lib/strutil'
import { tokenToKey } from '@/lib/api/file'

export function useLogin() {
  const { t } = useI18n()
  const { handleSubmit, isSubmitting } = useForm()
  const showError = ref(false)
  const webAccessDisabled = ref(true)
  const showConfirm = ref(false)
  const error = ref('')
  const showPasswordInput = ref(false)
  let ws: WebSocket

  const { value: password, errorMessage: passwordError } = useField('password', toTypedSchema(z.string({ required_error: 'valid.required' }).min(1, 'valid.required')))

  async function initRequest() {
    const token = localStorage.getItem('auth_token') ?? ''
    const options: RequestInit & { headers: Record<string, string> } = {
      method: 'POST',
      headers: getApiHeaders() as Record<string, string>,
    }
    if (token) {
      const uuid = randomUUID()
      const key = tokenToKey(token)
      const enc = chachaEncrypt(key, uuid)
      options.body = bitArrayToUint8Array(enc)
    }
    const r = await fetch(`${getApiBaseUrl()}/init`, options)
    if (r.status === 403) {
      showError.value = true; webAccessDisabled.value = true; error.value = 'web_access_disabled'; return
    }
    webAccessDisabled.value = false
    const bodyText = await r.text()
    if (r.status === 200 && token && !bodyText) {
      window.location.href = router.currentRoute.value.query['redirect']?.toString() ?? '/'; return
    }
    if (bodyText) { password.value = bodyText; showPasswordInput.value = false }
    else { showPasswordInput.value = true }
  }

  initRequest()

  const onSubmit = handleSubmit(async () => {
    const clientId = localStorage.getItem('client_id')
    const pass = (password.value as string) ?? ''
    const hash = sha512(pass)
    const key = hashToKey(hash)
    error.value = ''; showError.value = false

    await new Promise<void>((resolve) => {
      ws = new WebSocket(`${getWebSocketBaseUrl()}?cid=${clientId}&auth=1`)
      ws.onopen = async () => {
        const ua = await getAccurateAgent()
        const enc = chachaEncrypt(key, JSON.stringify({
          password: hash, browserName: ua.browser.name, browserVersion: ua.browser.version,
          osName: ua.os.name, osVersion: ua.os.version, isMobile: ua.isMobile,
        }))
        ws.send(bitArrayToUint8Array(enc))
      }
      ws.onmessage = async (event: MessageEvent) => {
        const d = chachaDecrypt(key, new Uint8Array(await event.data.arrayBuffer()))
        const r = JSON.parse(d)
        if (r.status === 'PENDING') { showConfirm.value = true }
        else { localStorage.setItem('auth_token', r.token); ws.close(); window.location.href = router.currentRoute.value.query['redirect']?.toString() ?? '/' }
      }
      ws.onclose = async (event: CloseEvent) => {
        resolve()
        if (event.reason === 'abort' || event.reason === 'OK') return
        showError.value = true; showConfirm.value = false
        if (!event.reason) {
          const r = await fetch(`${getApiBaseUrl()}/health_check`)
          if (r.status === 200) { error.value = 'failed_connect_ws'; return }
        }
        error.value = `login.${event.reason ? event.reason : 'failed'}`
      }
      window.setTimeout(() => { if (ws.readyState !== 1) ws.close(3001, 'timeout') }, 5000)
    })
  })

  function cancel() {
    showConfirm.value = false; showError.value = false; isSubmitting.value = false; ws.close(3001, 'abort')
  }

  return {
    showError, webAccessDisabled, showConfirm, error, showPasswordInput,
    password, passwordError, isSubmitting, onSubmit, cancel, t,
  }
}
