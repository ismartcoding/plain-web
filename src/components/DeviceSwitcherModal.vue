<template>
  <v-modal width="480px" @close="close">
    <template #headline>
      <button v-if="isLoginStep" class="login-back" :aria-label="$t('back')" @click="cancelLoginStep">
        <i-material-symbols:arrow-back-rounded />
      </button>
      <span>{{
        isLoginStep ? $t('log_in') + ': ' + loginHost : $t('device_discovery.change_device')
      }}</span>
    </template>
    <template #content>
      <div v-if="!isLoginStep" class="switcher">
        <section v-if="sessions.length || selfDevice" class="section">
          <h3 class="section-title">{{ $t('device_discovery.logged_in_devices') }}</h3>
          <ul class="card list-items">
            <VListItem v-if="selfDevice" :subtitle="selfDevice.host">
              <template #start>
                <v-dropdown v-model="infoOpen['self']">
                  <template #trigger>
                    <DeviceTypeIcon :device-type="selfDevice.deviceType" />
                  </template>
                  <pre class="view-raw">{{ selfDevice }}</pre>
                </v-dropdown>
              </template>
              <template #title>
                <span>{{ selfDevice.name }}</span>
                <span class="status-badge on">{{ $t('device_discovery.local') }}</span>
                <span v-if="localMode" class="status-badge on">{{
                  $t('device_discovery.current')
                }}</span>
              </template>
              <template #actions>
                <button
                  v-if="!localMode"
                  v-tooltip="$t('switch')"
                  class="icon-btn"
                  :aria-label="$t('device_discovery.change_device')"
                  @click.stop="switchToLocal"
                >
                  <i-material-symbols:swap-horiz-rounded />
                </button>
              </template>
            </VListItem>
            <VListItem v-for="s in sessions" :key="s.clientId" :subtitle="s.host">
              <template #start>
                <v-dropdown v-model="infoOpen[s.clientId]">
                  <template #trigger>
                    <DeviceTypeIcon :device-type="s.deviceType" />
                  </template>
                  <pre class="view-raw">{{ s }}</pre>
                </v-dropdown>
              </template>
              <template #title>
                <span>{{ s.name || s.host }}</span>
                <span v-if="s.clientId === currentClientId" class="status-badge on">{{
                  $t('device_discovery.current')
                }}</span>
              </template>
              <template #actions>
                <button
                  v-if="s.clientId !== currentClientId"
                  v-tooltip="$t('switch')"
                  class="icon-btn"
                  :aria-label="$t('device_discovery.change_device')"
                  @click.stop="switchTo(s)"
                >
                  <i-material-symbols:swap-horiz-rounded />
                </button>
                <button class="icon-btn danger" :aria-label="$t('delete')" @click.stop="remove(s)">
                  <i-material-symbols:delete-outline-rounded />
                </button>
              </template>
            </VListItem>
          </ul>
        </section>

        <section class="section">
          <DeviceDiscoveryStatus
            :status="status"
            @retry="retry"
            @open-settings="openLanPermissionSettings"
          />
          <div v-if="newDevices.length === 0" class="nearby-empty">
            <p>{{ $t('same_network_hint') }}</p>
          </div>
          <ul v-else class="card list-items">
            <VListItem v-for="d in newDevices" :key="d.id" :subtitle="d.ips.join(', ')">
              <template #title>
                <span>{{ d.name }}</span>
                <i-lucide:bluetooth
                  v-if="d.discoveryMethods.includes('BLE')"
                  v-tooltip="$t('discovered_via_bluetooth')"
                  class="discovery-icon"
                />
                <i-lucide:wifi
                  v-if="d.discoveryMethods.includes('LAN')"
                  v-tooltip="$t('discovered_via_lan')"
                  class="discovery-icon"
                />
                <span
                  v-if="d.status === 'PAIRING'"
                  v-tooltip="$t('waiting_for_confirmation')"
                  class="status-badge warn"
                  >{{ $t('pending') }}</span
                >
              </template>
              <template #start>
                <v-dropdown v-model="infoOpen[d.id]">
                  <template #trigger>
                    <DeviceTypeIcon :device-type="d.deviceType" />
                  </template>
                  <pre class="view-raw">{{ d }}</pre>
                </v-dropdown>
              </template>
              <template #end>
                <v-outlined-button
                  class="btn-sm"
                  :disabled="d.status === 'PAIRING'"
                  @click.stop="startLogin(d)"
                >
                  {{ $t('log_in') }}
                </v-outlined-button>
              </template>
            </VListItem>
          </ul>
        </section>
      </div>
      <div v-else class="login-panel">
        <LoginForm
          ref="loginFormRef"
          :redirect-on-success="false"
          @success="handleLoginSuccess"
        />
      </div>
    </template>
    <template #actions>
      <v-outlined-button @click="close">{{ $t('close') }}</v-outlined-button>
    </template>
  </v-modal>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { popModal } from './modal/methods'
import DeviceDiscoveryStatus from './DeviceDiscoveryStatus.vue'
import LoginForm from '@/views/login/LoginForm.vue'
import { useDeviceDiscovery, type DiscoveredDevice } from '@/hooks/use-device-discovery'
import { useDeviceSessionsStore } from '@/stores/device-sessions'
import type { DeviceSession } from '@/stores/device-sessions'
import { clearPendingLoginHost, setPendingLoginHost, setPendingLoginDeviceType, clearPendingLoginDeviceType } from '@/lib/api/api'
import { isLocalMode } from '@/lib/device/local-mode'
import { getDesktopClientId } from '@/lib/device/client-id'
import { loadSelfDevice, type SelfDevice } from '@/lib/device/self-device'

const store = useDeviceSessionsStore()
const { devices, status, start, stop, retry, openLanPermissionSettings } = useDeviceDiscovery()

const sessions = computed(() => store.sortedSessions)
const currentClientId = computed(() => store.currentClientId)
const localMode = computed(() => isLocalMode())
const isLoginStep = ref(false)
const loginHost = ref('')
const loginFormRef = ref<InstanceType<typeof LoginForm> | null>(null)
const selfDevice = ref<SelfDevice | null>(null)
const infoOpen = ref<Record<string, boolean>>({})

const desktopClientId = getDesktopClientId()
const newDevices = computed(() =>
  devices.value.filter(
    (d) =>
      d.id !== desktopClientId &&
      !sessions.value.some((s) => d.ips.some((ip) => s.host === `${ip}:${d.port}`)),
  ),
)

onMounted(() => {
  start()
  void loadSelf()
})
onUnmounted(() => stop())

async function loadSelf() {
  selfDevice.value = await loadSelfDevice()
}

function close() {
  if (isLoginStep.value) {
    clearPendingLoginHost()
    clearPendingLoginDeviceType()
  }
  popModal()
}

function switchTo(s: DeviceSession) {
  if (!s.token) {
    store.setCurrent('')
    if (s.deviceType) setPendingLoginDeviceType(s.deviceType)
    void startLoginStep(s.host)
    return
  }
  if (s.clientId === currentClientId.value) {
    close()
    return
  }
  store.setCurrent(s.clientId)
  window.location.href = '/'
}

function remove(s: DeviceSession) {
  const isCurrent = s.clientId === currentClientId.value
  store.remove(s.clientId)
  if (isCurrent) {
    close()
    window.location.href = '/'
  }
}

function startLogin(d: DiscoveredDevice) {
  const host = d.ips[0] ? `${d.ips[0]}:${d.port}` : ''
  if (!host) return
  store.setCurrent('')
  setPendingLoginDeviceType(d.deviceType)
  void startLoginStep(host)
}

async function startLoginStep(host: string) {
  loginHost.value = host
  setPendingLoginHost(host)
  isLoginStep.value = true
  await nextTick()
  await loginFormRef.value?.init({ autoSubmitWhenNoPassword: true })
}

function cancelLoginStep() {
  clearPendingLoginHost()
  clearPendingLoginDeviceType()
  isLoginStep.value = false
  loginHost.value = ''
}

function handleLoginSuccess() {
  close()
  window.location.href = '/'
}

function switchToLocal() {
  if (localMode.value) {
    close()
    return
  }
  store.setCurrent('')
  close()
  window.location.href = '/'
}
</script>

<style lang="scss" scoped>
.switcher {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-title {
  margin: 0;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--md-sys-color-on-surface-variant);
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--md-sys-color-on-surface-variant);
  cursor: pointer;
  flex-shrink: 0;

  svg {
    width: 16px;
    height: 16px;
  }

  &:hover {
    background: color-mix(in srgb, var(--md-sys-color-on-surface) 8%, transparent);
    color: var(--md-sys-color-on-surface);
  }

  &.danger:hover {
    background: color-mix(in srgb, var(--md-sys-color-error) 14%, transparent);
    color: var(--md-sys-color-error);
  }
}

.nearby-empty {
  padding-inline: 16px;
  text-align: center;
  color: var(--md-sys-color-on-surface-variant);
}

.discovery-icon {
  width: 16px;
  height: 16px;
  color: var(--md-sys-color-on-surface-variant);
  flex-shrink: 0;
}

.login-panel {
  width: min(320px, 80vw);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.login-back {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--md-sys-color-on-surface-variant);
  cursor: pointer;

  svg {
    width: 20px;
    height: 20px;
  }

  &:hover {
    background: color-mix(in srgb, var(--md-sys-color-on-surface) 8%, transparent);
    color: var(--md-sys-color-on-surface);
  }
}

.login-panel :deep(form),
.login-panel :deep(.tap-phone-text),
.login-panel :deep(.tap-phone) {
  width: 100%;
  text-align: center;
}
</style>
