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
import { onMounted, onUnmounted, watch } from 'vue'
import { useAppSocket } from '@/hooks/app-socket'
import { openWindow, setWindowDeviceName } from '@/lib/api/tauri-window'
import { useDeviceSessionsStore, LOCAL_CLIENT_ID } from '@/stores/device-sessions'

const { wsStatus, tapPhoneMessage, closeTapPhone } = useAppSocket()
const deviceSessions = useDeviceSessionsStore()

function onKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'N') {
    e.preventDefault()
    openWindow('/')
  }
}

// Keep the dock right-click menu label up to date for this window.
watch(
  () => deviceSessions.currentClientId,
  (clientId) => {
    const session = deviceSessions.sessions.find((s) => s.clientId === clientId)
    const name = clientId === LOCAL_CLIENT_ID ? 'Local' : (session?.name || session?.host || 'PlainApp')
    setWindowDeviceName(name)
  },
  { immediate: true },
)

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
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
