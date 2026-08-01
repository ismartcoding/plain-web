import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { invoke } from '@tauri-apps/api/core'
import emitter from '@/plugins/eventbus'
import toast from '@/components/toaster'
import { getWebSocketBaseUrl, getLocalToken } from '@/lib/api/api'
import { chachaDecrypt, chachaEncrypt, bitArrayToUint8Array } from '@/lib/api/crypto'
import { parseWebSocketData } from '@/lib/api/sjcl-arraybuffer'
import { applyDarkClass, changeColor, changeColorMode, getCurrentMode, getLastSavedAutoColorMode, isModeDark } from '@/lib/theme'
import { tokenToKey } from '@/lib/api/file'
import { getWindowClientId } from '@/lib/window-client'
import { getCurrentAuthToken, getCurrentDeviceHost } from '@/lib/device-current'
import { isLocalMode } from '@/lib/local-mode'
import { TauriWebSocket } from '@/lib/api/tauri-ws'
import { get as prefsGet, set as prefsSet } from '@/lib/prefs'

const EventType: { [key: number]: string } = {
  1: 'message_created',
  2: 'message_deleted',
  3: 'message_updated',
  4: 'feeds_fetched',
  5: 'screen_mirroring',
  7: 'notification_created',
  8: 'notification_updated',
  9: 'notification_deleted',
  10: 'notification_refreshed',
  11: 'pomodoro_action',
  12: 'pomodoro_settings_update',
  14: 'screen_mirror_audio_granted',
  15: 'bookmark_updated',
  16: 'download_progress',
  17: 'mms_sent',
  18: 'channels_updated',
  19: 'image_search_updated',
  20: 'peer_status_updated',
  21: 'device_name_updated',
  22: 'pairing_request_received',
  23: 'pairing_success',
  24: 'pairing_failed',
  25: 'pairing_canceled',
  26: 'pairing_started',
  27: 'nearby_device_found',
  28: 'channel_invite_received',
  29: 'nearby_discovery_started',
  30: 'nearby_discovery_stopped',
  31: 'screen_mirror_video',
  32: 'screen_mirror_video_codec',
  33: 'screen_mirror_audio',
  34: 'image_editor_update',
}

// Screen mirror binary frames (H.264 NAL / Opus) and image editor Yjs updates
// are sent raw — skip ChaCha20 decryption so the bytes are consumed directly.
const RAW_BINARY_EVENTS = new Set([
  31, // SCREEN_MIRROR_VIDEO
  33, // SCREEN_MIRROR_AUDIO
  34, // IMAGE_EDITOR_UPDATE
])

export function useAppSocket() {
  const { t } = useI18n()
  document.title = 'PlainApp'

  const wsStatus = ref('')
  const tapPhoneMessage = ref('')
  let retryConnectTimeout: ReturnType<typeof setTimeout> | undefined
  let clearStatusTimer: ReturnType<typeof setTimeout> | undefined
  let ws: WebSocket
  let retryTime = 1000
  let lastDiscoveryTime = 0
  const DISCOVERY_COOLDOWN_MS = 10_000

  const closeTapPhone = () => {
    tapPhoneMessage.value = ''
  }

  async function triggerDiscovery() {
    if (!__IS_TAURI__ || isLocalMode()) return
    const currentHost = getCurrentDeviceHost()
    if (!currentHost) return
    const now = Date.now()
    if (now - lastDiscoveryTime < DISCOVERY_COOLDOWN_MS) return
    lastDiscoveryTime = now
    try {
      const result = await invoke<{ devices: Array<{ id: string; ips: string[]; port: number }> }>('discover_devices')
      const currentId = getWindowClientId()
      if (!currentId) return
      const match = result.devices.find((d) => d.id === currentId)
      if (!match || match.ips.length === 0) return
      const newHost = `${match.ips[0]}:${match.port}`
      if (newHost === currentHost) return
      const data = prefsGet<{ sessions: Array<{ clientId: string; host: string }> } | null>('device_sessions', null)
      if (!data || !Array.isArray(data.sessions)) return
      const session = data.sessions.find((s) => s.clientId === currentId)
      if (!session) return
      session.host = newHost
      prefsSet('device_sessions', data)
    } catch (ex) {
      console.error('discovery error', ex)
    }
  }

  async function connect() {
    const clientId = prefsGet('client_id', '')
    const localMode = isLocalMode()
    const token = localMode ? getLocalToken() : getCurrentAuthToken()
    if (!token) {
      return
    }

    try {
      const key = tokenToKey(token)
      const wsUrl = `${getWebSocketBaseUrl()}/?cid=${clientId}`
      ws = (__IS_TAURI__ ? new TauriWebSocket(wsUrl) : new WebSocket(wsUrl)) as unknown as WebSocket
      ws.onopen = async () => {
        emitter.emit('app_socket_connection_changed', true)
        retryTime = 1000
        ws.send(bitArrayToUint8Array(chachaEncrypt(key, new Date().getTime().toString())))
        if (clearStatusTimer) clearTimeout(clearStatusTimer)
        clearStatusTimer = setTimeout(() => {
          wsStatus.value = ''
        }, 2000)
      }
      ws.onmessage = async (event: MessageEvent) => {
        const buffer = await event.data.arrayBuffer()
        const r = parseWebSocketData(buffer)
        const type = EventType[r.type]
        try {
          if (RAW_BINARY_EVENTS.has(r.type)) {
            // Zero-copy: pass the Uint8Array view directly. The view shares
            // the underlying WebSocket buffer — no slice, no memcpy. Downstream
            // (mirror-codec-video / mirror-codec-audio) consumes Uint8Array
            // and never touches .buffer, so the 4-byte type prefix is never
            // read. This matters for 1080p@60fps where each frame is ~100KB
            // and a per-frame slice would copy ~6MB/s.
            emitter.emit(type as any, r.data)
          } else {
            const json = chachaDecrypt(key, r.data)
            emitter.emit(type as any, json ? JSON.parse(json) : null)
          }
        } catch (ex) {
          console.error(ex)
        }
      }
      ws.onclose = () => {
        if (clearStatusTimer) {
          clearTimeout(clearStatusTimer)
          clearStatusTimer = undefined
        }
        wsStatus.value = 'closed'
        retryConnect()
      }
      ws.onerror = () => {
        wsStatus.value = 'error'
        ws.close()
        emitter.emit('app_socket_connection_changed', false)
      }
    } catch (ex) {
      console.error(ex)
      retryConnect()
    }
  }

  function retryConnect() {
    if (retryConnectTimeout) clearTimeout(retryConnectTimeout)
    if (__IS_TAURI__) {
      void triggerDiscovery()
    }
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
    emitter.on('tap_phone', (r: string) => {
      tapPhoneMessage.value = r
    })
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (getCurrentMode() !== 'auto') return
      changeColor()
    })
    try {
      initializeTheme()
    } catch (ex) {
      console.error(ex)
    }
    connect()
  })

  return { wsStatus, tapPhoneMessage, closeTapPhone }
}
