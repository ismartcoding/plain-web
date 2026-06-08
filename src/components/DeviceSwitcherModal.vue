<template>
  <v-modal @close="close">
    <template #headline>
      <button v-if="isLoginStep" class="login-back" :aria-label="$t('back')" @click="cancelLoginStep">
          <i-material-symbols:arrow-back-rounded />
      </button>
      {{ isLoginStep ? ($t('log_in') + ': ' + loginHost) : $t('device_discovery.change_device') }}
    </template>
    <template #content>
      <div v-if="!isLoginStep" class="switcher">
        <section v-if="sessions.length" class="section">
          <h3 class="section-title">{{ $t('device_discovery.logged_in_devices') }}</h3>
          <ul class="device-list">
            <li
              v-for="s in sessions"
              :key="s.clientId"
              class="device-item"
              :class="{ current: s.clientId === currentClientId, editing: editingId === s.clientId }"
              @click="editingId === s.clientId ? null : switchTo(s)"
            >
              <template v-if="editingId === s.clientId">
                <v-text-field
                  v-model="editValue"
                  class="edit-input"
                  autocapitalize="none"
                  autocorrect="off"
                  :spellcheck="false"
                  @click.stop
                  @keyup.enter="saveEdit(s)"
                  @keyup.esc="cancelEdit"
                />
                <button
                  class="icon-btn"
                  :aria-label="$t('save')"
                  @click.stop="saveEdit(s)"
                >
                  <i-material-symbols:check-rounded />
                </button>
                <button
                  class="icon-btn"
                  :aria-label="$t('cancel')"
                  @click.stop="cancelEdit"
                >
                  <i-material-symbols:close-rounded />
                </button>
              </template>
              <template v-else>
                <div class="device-info">
                  <span class="device-name">
                    <span class="device-status-dot" :class="{ online: isSessionOnline(s.clientId) }"></span>
                    <span>{{ s.name || s.host }}</span>
                  </span>
                  <span class="device-host">{{ s.host }}</span>
                </div>
                <span v-if="s.clientId === currentClientId" class="device-badge">
                  {{ $t('device_discovery.current') }}
                </span>
                <button
                  class="icon-btn"
                  :aria-label="$t('edit')"
                  @click.stop="startEdit(s)"
                >
                  <i-material-symbols:edit-outline-rounded />
                </button>
                <button
                  class="icon-btn danger"
                  :aria-label="$t('delete')"
                  @click.stop="remove(s)"
                >
                  <i-material-symbols:delete-outline-rounded />
                </button>
              </template>
            </li>
          </ul>
        </section>
        <section class="section">
          <DeviceDiscoveryStatus
            :status="status"
            @retry="retry"
            @open-settings="openLanPermissionSettings"
          />
          <ul v-if="newDevices.length" class="device-list">
            <li
              v-for="d in newDevices"
              :key="d.host"
              class="device-item"
              @click="addNew(d.host)"
            >
              <div class="device-info">
                <span class="device-name">{{ d.name }}</span>
                <span class="device-host">{{ d.host }}</span>
              </div>
              <i-material-symbols:chevron-right-rounded class="device-arrow" />
            </li>
          </ul>
          <v-text-field
            v-model="manualHost"
            :label="$t('device_discovery.manual_host')"
            class="form-control manual-input"
            autocapitalize="none"
            autocorrect="off"
            :spellcheck="false"
            @keyup.enter="addManual"
          />
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
      <v-outlined-button v-if="!isLoginStep" :disabled="localMode" @click="switchToLocal">
        {{ $t('device_discovery.switch_to_local') }}
      </v-outlined-button>
      <v-outlined-button v-if="!isLoginStep" @click="close">{{ $t('cancel') }}</v-outlined-button>
      <v-filled-button v-if="!isLoginStep" :disabled="!manualHost.trim()" @click="addManual">
        {{ $t('connect') }}
      </v-filled-button>
    </template>
  </v-modal>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { popModal } from './modal/methods'
import DeviceDiscoveryStatus from './DeviceDiscoveryStatus.vue'
import LoginForm from '@/views/login/LoginForm.vue'
import { useDeviceDiscovery } from '@/hooks/use-device-discovery'
import { useDeviceSessionsStore } from '@/stores/device-sessions'
import { useChatStore } from '@/stores/chat'
import type { DeviceSession } from '@/stores/device-sessions'
import { clearPendingLoginHost, setPendingLoginHost } from '@/lib/api/api'
import { isLocalMode } from '@/lib/local-mode'

const store = useDeviceSessionsStore()
const chatStore = useChatStore()
const { devices, status, start, stop, retry, openLanPermissionSettings } = useDeviceDiscovery()

const sessions = computed(() => store.sortedSessions)
const currentClientId = computed(() => store.currentClientId)
const localMode = computed(() => isLocalMode())
const onlinePeerIds = computed(() =>
  new Set(chatStore.peers.filter((peer) => peer.online).map((peer) => peer.id))
)
const manualHost = ref('')
const editingId = ref<string | null>(null)
const editValue = ref('')
const isLoginStep = ref(false)
const loginHost = ref('')
const loginFormRef = ref<InstanceType<typeof LoginForm> | null>(null)

// Devices found by scanning that aren't already in the saved sessions list.
const newDevices = computed(() =>
  devices.value.filter((d) => !sessions.value.some((s) => s.host === d.host))
)

onMounted(() => start())
onUnmounted(() => stop())

function close() {
  if (isLoginStep.value) {
    clearPendingLoginHost()
  }
  popModal()
}

function stripScheme(v: string): string {
  return v.replace(/^https?:\/\//, '')
}

function isSessionOnline(clientId: string): boolean {
  return onlinePeerIds.value.has(clientId)
}

function switchTo(s: DeviceSession) {
  if (!s.token) {
    store.setCurrent('')
    void startLoginStep(s.host)
    return
  }
  if (s.clientId === currentClientId.value) {
    close()
    return
  }
  store.setCurrent(s.clientId)
  // Full reload so all stores/sockets re-init against the new host.
  window.location.href = '/'
}

function remove(s: DeviceSession) {
  const isCurrent = s.clientId === currentClientId.value
  store.remove(s.clientId)
  if (isCurrent) {
    // The active device was removed; store.remove() drops the binding.
    close()
    window.location.href = '/'
  }
}

function startEdit(s: DeviceSession) {
  editingId.value = s.clientId
  editValue.value = s.host
}

function cancelEdit() {
  editingId.value = null
  editValue.value = ''
}

function saveEdit(s: DeviceSession) {
  const newHost = stripScheme(editValue.value.trim())
  if (!newHost) return
  if (newHost === s.host) {
    cancelEdit()
    return
  }
  store.updateHost(s.clientId, newHost)
  // If the edited entry is the active device, reload so api.ts picks up the new host.
  if (s.clientId === currentClientId.value) {
    window.location.href = '/'
    return
  }
  cancelEdit()
}

function addNew(host: string) {
  store.setCurrent('')
  startLoginStep(host)
}

function addManual() {
  const host = stripScheme(manualHost.value.trim())
  if (!host) return
  addNew(host)
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
  width: min(420px, 80vw);
  display: flex;
  flex-direction: column;
}

.section {
  display: flex;
  flex-direction: column;
}

.section-title {
  margin: 0 0 8px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--md-sys-color-on-surface-variant);
}

.device-list {
  list-style: none;
  padding: 0;
  margin: 0 0 16px 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.device-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s;
  background: var(--md-sys-color-surface);

  &:hover {
    background: color-mix(in srgb, var(--md-sys-color-primary) 8%, var(--md-sys-color-surface));
  }

  &.current {
    background: color-mix(in srgb, var(--md-sys-color-primary) 12%, var(--md-sys-color-surface));
  }
}

.device-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.device-name {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  font-size: 0.9rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.device-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--md-sys-color-outline);
  flex-shrink: 0;
}

.device-status-dot.online {
  background: #20c997;
}

.device-host {
  font-size: 0.75rem;
  color: var(--md-sys-color-on-surface-variant);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.device-badge {
  font-size: 0.7rem;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
}

.device-arrow {
  color: var(--md-sys-color-on-surface-variant);
  font-size: 1.2rem;
  flex-shrink: 0;
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

.device-item.editing {
  cursor: default;
  background: color-mix(in srgb, var(--md-sys-color-primary) 6%, var(--md-sys-color-surface));
}

.edit-input {
  flex: 1;
  min-width: 0;
}

.empty {
  margin: 0;
  font-size: 0.85rem;
  color: var(--md-sys-color-on-surface-variant);
}

.manual-input {
  margin-top: 8px;
  width: 100%;
}

.login-panel {
  width: min(320px, 80vw);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.login-host {
  width: 100%;
  margin-bottom: 12px;
  word-break: break-word;
  text-align: center;
}

.login-back {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  margin-bottom: 8px;
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
