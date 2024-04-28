<template>
  <div class="top-error" v-if="wsStatus">
    {{ $t('fix_disconnect_tips') }}
  </div>
  <router-view />
  <Teleport to="body">
    <modal-container />
    <div class="tap-phone-container" v-click-away="closeTapPhone" v-if="tapPhoneMessage" @click="closeTapPhone">
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
import { aesDecrypt, aesEncrypt, bitArrayToUint8Array } from './lib/api/crypto'
import { parseWebSocketData } from './lib/api/sjcl-arraybuffer'
import { applyDarkClass, changeColor, changeColorAndMode, changeColorMode, getCurrentMode, getCurrentSeedColor, getCurrentThemeString, getLastSavedAutoColorMode, isModeDark } from './lib/theme/theme'
import { applyThemeString } from './lib/theme/apply-theme-string'
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
  6: 'ai_chat_replied',
  7: 'notification_created',
  8: 'notification_updated',
  9: 'notification_deleted',
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
      const enc = aesEncrypt(key, new Date().getTime().toString())
      ws.send(bitArrayToUint8Array(enc))
      wsStatus.value = ''
    }

    ws.onmessage = async (event: MessageEvent) => {
      const buffer = await event.data.arrayBuffer()
      const plainTypes = [5]
      const r = parseWebSocketData(buffer, plainTypes)
      const type = EventType[r.type] ?? ''
      if (plainTypes.includes(r.type)) {
        emitter.emit(type, new Blob([r.data], { type: 'application/octet-stream' }))
        console.log(type)
      } else {
        try {
          const json = aesDecrypt(key, r.data)
          emitter.emit(type, JSON.parse(json))
          console.log(`${type}, ${json}`)
        } catch (ex) {
          console.error(ex)
        }
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
    // Recalculate auto mode with the same theme color.
    changeColorMode('auto')
  }
}

function initializeTheme() {
  const lastThemeString = getCurrentThemeString()
  if (lastThemeString) {
    applyThemeString(document, lastThemeString)
    applyDarkClass(isModeDark(getCurrentMode() || 'auto', false))
  } else {
    // Generates a primary color close to GM3 baseline primary color.
    changeColorAndMode('#0000FF', 'auto')
  }
}

onMounted(() => {
  emitter.on('toast', (r: string) => {
    toast(t(r))
  })

  emitter.on('tap_phone', (r: string) => {
    tapPhoneMessage.value = r
  })

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getCurrentMode() !== 'auto') {
      return
    }

    changeColor(getCurrentSeedColor()!)
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
