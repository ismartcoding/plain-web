<template>
  <router-view />
  <modal-container />
</template>
<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import emitter from './plugins/eventbus'
import toast from '@/components/toaster'
import { getWebSocketBaseUrl } from './lib/api/api'
import { aesDecrypt, aesEncrypt, bitArrayToUint8Array } from './lib/api/crypto'
import sjcl from 'sjcl'
import { arrayBuffertoBits } from './lib/api/sjcl-arraybuffer'
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

  const key = sjcl.codec.base64.toBits(token)

  ws = new WebSocket(`${getWebSocketBaseUrl()}?cid=${clientId}`)
  ws.onopen = async () => {
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
    setTimeout(() => {
      connect()
    }, Math.min(10000, retryTime))
    retryTime += 1000
  }

  ws.onerror = (event: Event) => {
    console.error(event)
    ws.close()
  }
}
onMounted(() => {
  emitter.on('toast', (r: string) => {
    toast(t(r))
  })

  connect()
})
</script>
