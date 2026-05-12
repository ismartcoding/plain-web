<template>
  <header class="header">
    <header-actions :logged-in="false" />
  </header>
  <h1>PlainApp</h1>
  <div class="login-block">
    <div v-show="isTauri && !deviceHost">
      <ul v-if="sessionsStore.sortedSessions.length" class="list-items session-list">
        <SessionListItem
          v-for="s in sessionsStore.sortedSessions"
          :key="s.clientId"
          :name="s.name"
          :host="s.host"
          :loading="loadingClientId === s.clientId"
          @select="resumeSession(s)"
        />
      </ul>
      <div v-if="sessionsStore.sortedSessions.length" class="divider"></div>
      <DiscoverySection :connecting="isConnecting" @device-selected="onDeviceSelected" />
      <ManualConnectSection :connecting="isConnecting" :error="connectError" @device-selected="onDeviceSelected" @cancel="cancelConnect" />
    </div>
    <div v-if="isTauri && deviceHost" class="device-bar subtle">
      <v-icon-button @click="cancelConnect">
        <i-material-symbols:arrow-back-rounded />
      </v-icon-button>
      <span class="device-bar-host">{{ deviceHost }}</span>
    </div>
    <LoginForm v-if="deviceHost" ref="loginFormRef" />
  </div>
  <div v-if="showWarning" class="tips">{{ $t('browser_warning') }}</div>
</template>
<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import type { DeviceSession } from '@/stores/device-sessions'
import DiscoverySection from './DiscoverySection.vue'
import LoginForm from './LoginForm.vue'
import ManualConnectSection from './ManualConnectSection.vue'
import SessionListItem from './SessionListItem.vue'
import { useDeviceSessionsStore } from '@/stores/device-sessions'
import { clearPendingLoginHost, getPendingLoginHost, setPendingLoginHost } from '@/lib/api/api'

const CONNECT_ERROR = 'device_discovery.connect_failed'

const showWarning = window.location.protocol !== 'http:' && !(window.navigator as any).userAgentData
const isTauri = __IS_TAURI__
const sessionsStore = useDeviceSessionsStore()

const loginFormRef = ref<InstanceType<typeof LoginForm> | null>(null)
const deviceHost = ref('')
const isConnecting = ref(false)
const connectError = ref('')
const loadingClientId = ref<string | null>(null)

let connectCancelled = false

restorePendingLoginHost()
if (!isTauri) {
  setPendingLoginHost(window.location.host)
}
deviceHost.value = getPendingLoginHost() || sessionsStore.currentSession?.host || ''

// Session resumption handler
async function resumeSession(session: DeviceSession) {
  if (loadingClientId.value) return

  loadingClientId.value = session.clientId
  connectError.value = ''
  sessionsStore.setCurrent(session.clientId)
  setPendingLoginHost(session.host)
  deviceHost.value = session.host

  try {
    await initializeLoginForm()
  } catch {
    sessionsStore.setCurrent('')
    showConnectFailure()
    clearSelectedDevice()
  } finally {
    loadingClientId.value = null
  }
}

// Device discovery handlers
function cancelConnect() {
  connectCancelled = true
  isConnecting.value = false
  clearSelectedDevice()
}

async function onDeviceSelected(host: string) {
  setPendingLoginHost(host)
  isConnecting.value = true
  connectCancelled = false
  connectError.value = ''
  deviceHost.value = host

  try {
    await initializeLoginForm({ autoSubmitWhenNoPassword: true })
  } catch {
    if (!connectCancelled) {
      showConnectFailure()
      clearSelectedDevice()
    }
  } finally {
    if (!connectCancelled) {
      isConnecting.value = false
    }
  }
}

onMounted(() => {
  if (!deviceHost.value) return
  initializeLoginForm().catch(() => {
    showConnectFailure()
  })
})

function restorePendingLoginHost() {
  const host = sessionStorage.getItem('pending_login_host') || ''
  if (!host) return
  sessionStorage.removeItem('pending_login_host')
  setPendingLoginHost(host)
}

function clearSelectedDevice() {
  clearPendingLoginHost()
  deviceHost.value = ''
}

function showConnectFailure() {
  connectError.value = CONNECT_ERROR
}

async function initializeLoginForm(options?: { autoSubmitWhenNoPassword?: boolean }) {
  await nextTick()
  if (!loginFormRef.value) {
    throw new Error('login_form_not_ready')
  }
  await loginFormRef.value.init(options)
}
</script>


<style lang="scss" scoped>
.header {
  display: flex;
  justify-content: end;
  margin-top: 6px;
}

.session-list {
  margin: 0 0 8px;
  padding: 0;
}

.divider {
  height: 1px;
  background: var(--md-sys-color-outline-variant);
  margin: 8px 0;
}

.device-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.device-bar-host {
  flex: 1;
  min-width: 0;
  word-break: break-word;
}

h1 {
  margin-top: 100px;
  text-align: center;
}

.login-block {
  width: 320px;
  margin: 0 auto;
  --outlined-field-bg: var(--md-sys-color-surface-variant);
  background-color: var(--md-sys-color-surface-variant);
  border-radius: var(--pl-shape-xl);
  padding-block: var(--pl-spacing-xl);
  padding: 40px;
}

.tips {
  text-align: center;
  padding: 16px;
  width: 320px;
  margin: 0 auto;
}
</style>
