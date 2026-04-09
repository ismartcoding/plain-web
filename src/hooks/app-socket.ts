import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import emitter from '@/plugins/eventbus'
import toast from '@/components/toaster'
import { getWebSocketBaseUrl } from '@/lib/api/api'
import { chachaDecrypt, chachaEncrypt, bitArrayToUint8Array } from '@/lib/api/crypto'
import { parseWebSocketData } from '@/lib/api/sjcl-arraybuffer'
import { applyDarkClass, changeColor, changeColorMode, getCurrentMode, getLastSavedAutoColorMode, isModeDark } from '@/lib/theme'
import { tokenToKey } from '@/lib/api/file'

const EventType: { [key: number]: string } = {
  1: 'message_created', 2: 'message_deleted', 3: 'message_updated',
  4: 'feeds_fetched', 5: 'screen_mirroring', 6: 'webrtc_signaling',
  7: 'notification_created', 8: 'notification_updated', 9: 'notification_deleted',
  10: 'notification_refreshed', 11: 'pomodoro_action', 12: 'pomodoro_settings_update',
  13: 'message_cleared', 14: 'screen_mirror_audio_granted', 15: 'bookmark_updated',
  16: 'download_progress', 18: 'channels_updated', 19: 'image_search_updated',
}

export function useAppSocket() {
  const { t } = useI18n()
  document.title = 'PlainApp'

  const wsStatus = ref('')
  const tapPhoneMessage = ref('')
  let retryConnectTimeout: ReturnType<typeof setTimeout> | undefined
  let ws: WebSocket
  let retryTime = 1000

  const closeTapPhone = () => { tapPhoneMessage.value = '' }

  async function connect() {
    const clientId = localStorage.getItem('client_id')
    const token = localStorage.getItem('auth_token') ?? ''
    if (!token) return

    try {
      const key = tokenToKey(token)
      ws = new WebSocket(`${getWebSocketBaseUrl()}?cid=${clientId}`)
      ws.onopen = async () => {
        emitter.emit('app_socket_connection_changed', true)
        console.log('WebSocket is connecting to app')
        retryTime = 1000
        ws.send(bitArrayToUint8Array(chachaEncrypt(key, new Date().getTime().toString())))
        wsStatus.value = ''
      }
      ws.onmessage = async (event: MessageEvent) => {
        const buffer = await event.data.arrayBuffer()
        const r = parseWebSocketData(buffer)
        const type = EventType[r.type]
        try {
          const json = chachaDecrypt(key, r.data)
          emitter.emit(type as any, json ? JSON.parse(json) : null)
          console.log(`ws.onmessage: ${type}, ${json}`)
        } catch (ex) { console.error(ex) }
        wsStatus.value = ''
      }
      ws.onclose = (event: CloseEvent) => { console.error(event); wsStatus.value = 'closed'; retryConnect() }
      ws.onerror = (event: Event) => { console.error(event); wsStatus.value = 'error'; ws.close(); emitter.emit('app_socket_connection_changed', false) }
    } catch (ex) { console.error(ex); retryConnect() }
  }

  function retryConnect() {
    if (retryConnectTimeout) clearTimeout(retryConnectTimeout)
    retryConnectTimeout = setTimeout(() => connect(), Math.min(5000, retryTime))
    retryTime += 1000
  }

  function initializeTheme() {
    applyDarkClass(isModeDark(getCurrentMode() || 'auto', false))
    if (getCurrentMode() === 'auto') {
      const actual = isModeDark('auto', false) ? 'dark' : 'light'
      if (actual !== getLastSavedAutoColorMode()) changeColorMode('auto')
    }
  }

  onMounted(() => {
    emitter.on('toast', (r: string) => toast(t(r), 'error'))
    emitter.on('tap_phone', (r: string) => { tapPhoneMessage.value = r })
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (getCurrentMode() !== 'auto') return
      changeColor()
    })
    try { initializeTheme() } catch (ex) { console.error(ex) }
    connect()
  })

  return { wsStatus, tapPhoneMessage, closeTapPhone }
}
