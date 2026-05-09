<template>
  <v-modal @close="close">
    <template #headline>
      {{ $t('device_discovery.change_device') }}
    </template>
    <template #content>
      <div class="switcher">
        <!-- Logged-in devices -->
        <section class="section">
          <h3 class="section-title">{{ $t('device_discovery.logged_in_devices') }}</h3>
          <ul v-if="sessions.length" class="device-list">
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
                  <span class="device-name">{{ s.name || s.host }}</span>
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
          <p v-else class="empty">{{ $t('device_discovery.no_devices_yet') }}</p>
        </section>

        <div class="divider"></div>

        <!-- Add new -->
        <section class="section">
          <h3 class="section-title">{{ $t('device_discovery.add_device') }}</h3>
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
    </template>
    <template #actions>
      <v-outlined-button @click="close">{{ $t('cancel') }}</v-outlined-button>
      <v-filled-button :disabled="!manualHost.trim()" @click="addManual">
        {{ $t('connect') }}
      </v-filled-button>
    </template>
  </v-modal>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { popModal } from './modal/methods'
import DeviceDiscoveryStatus from './DeviceDiscoveryStatus.vue'
import { useDeviceDiscovery } from '@/hooks/use-device-discovery'
import { useDeviceSessionsStore } from '@/stores/device-sessions'
import type { DeviceSession } from '@/stores/device-sessions'

const store = useDeviceSessionsStore()
const router = useRouter()
const { devices, status, start, stop, retry, openLanPermissionSettings } = useDeviceDiscovery()

const sessions = computed(() => store.sortedSessions)
const currentClientId = computed(() => store.currentClientId)
const manualHost = ref('')
const editingId = ref<string | null>(null)
const editValue = ref('')

// Devices found by scanning that aren't already in the saved sessions list.
const newDevices = computed(() =>
  devices.value.filter((d) => !sessions.value.some((s) => s.host === d.host))
)

onMounted(() => start())
onUnmounted(() => stop())

function close() {
  popModal()
}

function stripScheme(v: string): string {
  return v.replace(/^https?:\/\//, '')
}

function switchTo(s: DeviceSession) {
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
    // The active device was removed — store.remove() already cleared currentClientId.
    close()
    window.location.href = '/login'
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
  // Clear currentClientId so the router allows navigation to /login.
  store.setCurrent('')
  // Pass the pre-selected host to LoginView via sessionStorage.
  sessionStorage.setItem('pending_login_host', host)
  close()
  router.push('/login')
}

function addManual() {
  const host = stripScheme(manualHost.value.trim())
  if (!host) return
  addNew(host)
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

.divider {
  height: 1px;
  background: var(--md-sys-color-outline-variant);
  margin: 16px 0;
}

.device-list {
  list-style: none;
  padding: 0;
  margin: 0 0 8px;
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
  font-weight: 500;
  font-size: 0.9rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
</style>
