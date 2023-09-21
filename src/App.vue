<template>
  <router-view />
  <Teleport to="body">
    <modal-container />
  </Teleport>
</template>
<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import emitter from './plugins/eventbus'
import toast from '@/components/toaster'
import { getWebSocketBaseUrl } from './lib/api/api'
import { aesDecrypt, aesEncrypt, bitArrayToUint8Array } from './lib/api/crypto'
import { arrayBuffertoBits } from './lib/api/sjcl-arraybuffer'
import {
  applyDarkClass,
  changeColor,
  changeColorAndMode,
  changeColorMode,
  getCurrentMode,
  getCurrentSeedColor,
  getCurrentThemeString,
  getLastSavedAutoColorMode,
  isModeDark,
} from './lib/theme/theme'
import { applyThemeString } from './lib/theme/apply-theme-string'
import { tokenToKey } from './lib/api/file'
const { t } = useI18n()
document.title = t('app_name')

let ws: WebSocket
let retryTime = 1000

async function connect() {
  const clientId = localStorage.getItem('client_id')
  const token = localStorage.getItem('auth_token') ?? ''
  if (!token) {
    return
  }

  const key = tokenToKey(token)

  ws = new WebSocket(`${getWebSocketBaseUrl()}?cid=${clientId}`)
  ws.onopen = async () => {
    emitter.emit('app_socket_connection_changed', true)
    console.log('WebSocket is connecting to app')
    retryTime = 1000
    const enc = aesEncrypt(key, new Date().getTime().toString())
    ws.send(bitArrayToUint8Array(enc))
  }

  ws.onmessage = async (event: MessageEvent) => {
    let r: any
    try {
      r = JSON.parse(await event.data.text())
    } catch (ex) {
      r = JSON.parse(aesDecrypt(key, arrayBuffertoBits(await event.data.arrayBuffer())))
    }
    console.log(r)
    if (r.type === 'FEEDS_FETCHED') {
      emitter.emit('feeds_fetched', JSON.parse(r.data))
    } else if (r.type === 'AI_CHAT_REPLIED') {
      emitter.emit('ai_chat_replied', JSON.parse(r.data))
    } else if (r.type === 'SCREEN_MIRRORING') {
      emitter.emit('screen_mirrorring', r.data)
    } else if (r.type === 'MESSAGE_CREATED') {
      emitter.emit('message_created', JSON.parse(r.data))
    } else if (r.type === 'MESSAGE_DELETED') {
      emitter.emit('message_deleted', JSON.parse(r.data))
    } else if (r.type === 'MESSAGE_UPDATED') {
      emitter.emit('message_updated', JSON.parse(r.data))
    }
  }

  ws.onclose = (_event: CloseEvent) => {
    setTimeout(
      () => {
        connect()
      },
      Math.min(10000, retryTime)
    )
    retryTime += 1000
  }

  ws.onerror = (event: Event) => {
    console.error(event)
    ws.close()
    emitter.emit('app_socket_connection_changed', false)
  }
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
    applyDarkClass()
  } else {
    // Generates a primary color close to GM3 baseline primary color.
    changeColorAndMode('#0000FF', 'auto')
  }
}

onMounted(() => {
  emitter.on('toast', (r: string) => {
    toast(t(r))
  })

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getCurrentMode() !== 'auto') {
      return
    }

    changeColor(getCurrentSeedColor()!)
  })

  initializeTheme()

  determinePageNavigationAutoMode()

  connect()
})
</script>
