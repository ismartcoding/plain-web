<template>
  <div v-if="wsStatus" class="top-error">
    {{ $t('fix_disconnect_tips') }}
  </div>
  <router-view />
  <Teleport to="body">
    <modal-container />
    <div v-if="tapPhoneMessage" v-click-away="closeTapPhone" class="tap-phone-container" @click="closeTapPhone">
      <div>
        {{ tapPhoneMessage }}
      </div>
      <TouchPhone />
    </div>
  </Teleport>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import emitter from './plugins/eventbus'
import toast from '@/components/toaster'
import { getWebSocketBaseUrl } from './lib/api/api'
import { chachaDecrypt, chachaEncrypt, bitArrayToUint8Array } from './lib/api/crypto'
import { parseWebSocketData } from './lib/api/sjcl-arraybuffer'
import { applyDarkClass, changeColor, changeColorMode, getCurrentMode, getLastSavedAutoColorMode, isModeDark } from './lib/theme'
import TouchPhone from '@/assets/touch-phone.svg'
import { tokenToKey } from './lib/api/file'
let retryConnectTimeout = 0
const { t } = useI18n()
document.title = t('app_name')
const wsStatus = ref('')
const tapPhoneMessage = ref('')

let ws: WebSocket
let retryTime = 1000 // 1s

const closeTapPhone = () => {
  tapPhoneMessage.value = ''
}

const EventType: { [key: number]: string } = {
  1: 'message_created',
  2: 'message_deleted',
  3: 'message_updated',
  4: 'feeds_fetched',
  5: 'screen_mirroring',
  6: 'webrtc_signaling',
  7: 'notification_created',
  14: 'screen_mirror_audio_granted',
  8: 'notification_updated',
  9: 'notification_deleted',
  10: 'notification_refreshed',
  11: 'pomodoro_action',
  12: 'pomodoro_settings_update',
  13: 'chat_settings_update',
}

async function connect() {
  const clientId = localStorage.getItem('client_id')
  const token = localStorage.getItem('auth_token') ?? ''
  if (!token) {
    return
  }

  try {
    const key = tokenToKey(token)

    ws = new WebSocket(`${getWebSocketBaseUrl()}?cid=${clientId}`)
    ws.onopen = async () => {
      emitter.emit('app_socket_connection_changed', true)
      console.log('WebSocket is connecting to app')
      retryTime = 1000 // reset retry time
      const enc = chachaEncrypt(key, new Date().getTime().toString())
      ws.send(bitArrayToUint8Array(enc))
      wsStatus.value = ''
    }

    ws.onmessage = async (event: MessageEvent) => {
      const buffer = await event.data.arrayBuffer()
      const r = parseWebSocketData(buffer)
      const type = EventType[r.type]
      try {
        const json = chachaDecrypt(key, r.data)
        emitter.emit(type, json ? JSON.parse(json) : null)
        console.log(`ws.onmessage: ${type}, ${json}`)
      } catch (ex) {
        console.error(ex)
      }
      wsStatus.value = ''
    }

    ws.onclose = (event: CloseEvent) => {
      console.error(event)
      wsStatus.value = 'closed'
      retryConnect()
    }

    ws.onerror = (event: Event) => {
      console.error(event)
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
  if (retryConnectTimeout) {
    clearTimeout(retryConnectTimeout)
  }
  retryConnectTimeout = setTimeout(
    () => {
      connect()
    },
    Math.min(5000, retryTime) // wait at most 5s
  )
  retryTime += 1000
}

function determinePageNavigationAutoMode() {
  if (getCurrentMode() !== 'auto') {
    return
  }

  const actualColorMode = isModeDark('auto', false) ? 'dark' : 'light'
  const lastSavedAutoColorMode = getLastSavedAutoColorMode()

  if (actualColorMode !== lastSavedAutoColorMode) {
    changeColorMode('auto')
  }
}

function initializeTheme() {
   applyDarkClass(isModeDark(getCurrentMode() || 'auto', false))
}

onMounted(() => {
  emitter.on('toast', (r: string) => {
    toast(t(r), 'error')
  })

  emitter.on('tap_phone', (r: string) => {
    tapPhoneMessage.value = r
  })

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getCurrentMode() !== 'auto') {
      return
    }

    changeColor()
  })

  try {
    initializeTheme()
    determinePageNavigationAutoMode()
  } catch (ex) {
    console.error(ex)
  }

  connect()
})
</script>

<style scoped>
.top-error {
  background-color: var(--md-sys-color-error);
  color: var(--md-sys-color-on-error);
  padding: 8px;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
