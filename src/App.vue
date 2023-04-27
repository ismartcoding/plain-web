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
import { aesDecrypt, aesEncrypt } from './lib/api/crypto'
import sjcl from 'sjcl'
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
    console.log('WebSocket is connected to app')
    retryTime = 1000
    const enc = aesEncrypt(key, new Date().getTime().toString())
    ws.send(sjcl.codec.base64.fromBits(enc))
  }

  ws.onmessage = async (event: MessageEvent) => {
    const r = JSON.parse(aesDecrypt(key, sjcl.codec.base64.toBits(event.data)))
    // console.log(r)
    if (r.type === 'FEEDS_FETCHED') {
      emitter.emit('feeds_fetched', JSON.parse(r.data))
    } else if (r.type === 'AI_CHAT_REPLIED') {
      emitter.emit('ai_chat_replied', JSON.parse(r.data))
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
