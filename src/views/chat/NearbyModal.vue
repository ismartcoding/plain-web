<template>
  <v-modal @close="popModal">
    <template #headline>
      {{ $t('discover_devices') }}
    </template>
    <template #content>
      <!-- Incoming pair request banner -->
      <div v-if="incomingRequest" class="pair-request-card">
        <div class="pair-request-icon"><i-lucide:link /></div>
        <p>{{ $t('pair_request_from', { name: incomingRequest.request.fromName }) }}</p>
        <div class="pair-request-actions">
          <v-outlined-button @click="reject">{{ $t('reject') }}</v-outlined-button>
          <v-filled-button @click="accept">{{ $t('accept') }}</v-filled-button>
        </div>
      </div>

      <!-- Scanning indicator -->
      <div class="nearby-searching">
        <v-circular-progress indeterminate class="sm" />
        <span>{{ $t('scanning') }}</span>
      </div>

      <!-- Device list -->
      <ul v-if="discoveredDevices.length > 0" class="nearby-list">
        <li
          v-for="d in discoveredDevices"
          :key="d.id"
          class="nearby-item"
          :class="{ active: pairingDeviceId === d.id, disabled: !!pairingDeviceId && pairingDeviceId !== d.id }"
        >
          <span class="device-icon" aria-hidden="true">
            <i-lucide:smartphone v-if="d.deviceType === 'android' || d.deviceType === 'phone'" />
            <i-lucide:tablet v-else-if="d.deviceType === 'tablet'" />
            <i-lucide:laptop v-else-if="d.deviceType === 'pc'" />
            <i-lucide:monitor v-else />
          </span>
          <span class="device-info">
            <span class="device-name">{{ d.name }}</span>
            <span class="device-ip">{{ d.ip }}</span>
          </span>
          <span class="device-action">
            <v-outlined-button
              v-if="pairingDeviceId === d.id"
              class="sm"
              @click.stop="cancel(d)"
            >
              {{ $t('cancel') }}
            </v-outlined-button>
            <v-filled-button
              v-else
              class="sm"
              @click.stop="startPair(d)"
            >
              {{ $t('pair') }}
            </v-filled-button>
          </span>
        </li>
      </ul>

      <div v-else class="nearby-spacer"></div>
    </template>
    <template #actions>
      <v-outlined-button @click="popModal">{{ $t('close') }}</v-outlined-button>
    </template>
  </v-modal>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { popModal } from '@/components/modal'
import { useDeviceDiscovery, type DiscoveredDevice } from '@/hooks/use-device-discovery'
import { useDevicePairing } from '@/hooks/use-device-pairing'

const props = defineProps<{
  onPaired?: (peerId: string) => void | Promise<void>
}>()

const { devices: discoveredDevices, start, stop } = useDeviceDiscovery()
const { status: pairingStatus, pairedPeerId, pairDevice, cancelPairing, acceptPairing, rejectPairing, incomingRequest } = useDevicePairing()

const pairingDeviceId = ref('')

async function startPair(d: DiscoveredDevice) {
  if (pairingDeviceId.value) return
  pairingDeviceId.value = d.id
  stop()
  await pairDevice({ id: d.id, name: d.name, ip: d.ip, port: d.port, deviceType: d.deviceType })
}

async function cancel(d: DiscoveredDevice) {
  await cancelPairing(d.id)
  pairingDeviceId.value = ''
  start()
}

async function accept() {
  if (!incomingRequest.value) return
  await acceptPairing(incomingRequest.value.request, incomingRequest.value.senderIp)
}

async function reject() {
  if (!incomingRequest.value) return
  await rejectPairing(incomingRequest.value.request, incomingRequest.value.senderIp)
}

watch(pairingStatus, (status) => {
  if (status === 'success') {
    const peerId = pairedPeerId.value || pairingDeviceId.value
    if (peerId) props.onPaired?.(peerId)
    popModal()
  } else if (status === 'failed' || status === 'cancelled') {
    pairingDeviceId.value = ''
    start()
  }
})

onMounted(() => start())
onUnmounted(() => stop())
</script>

<style lang="scss" scoped>
.pair-request-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px;
  margin-bottom: 12px;
  border-radius: 12px;
  border: 1px solid var(--md-sys-color-primary);
  background: color-mix(in srgb, var(--md-sys-color-primary) 8%, transparent);
  text-align: center;

  .pair-request-icon {
    font-size: 1.5rem;
    color: var(--md-sys-color-primary);
  }

  p {
    margin: 0;
    font-size: 0.9rem;
    color: var(--md-sys-color-on-surface);
  }

  .pair-request-actions {
    display: flex;
    gap: 8px;
    margin-top: 4px;
  }
}

.nearby-searching {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0 4px;
  color: var(--md-sys-color-on-surface-variant);
  font-size: 0.875rem;
}

.nearby-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.nearby-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;

  &:hover:not(.disabled) {
    background: var(--md-sys-color-surface-container);
  }

  &.active {
    background: color-mix(in srgb, var(--md-sys-color-primary) 10%, transparent);
  }

  &.disabled {
    opacity: 0.45;
    cursor: default;
    pointer-events: none;
  }

  .device-icon {
    flex-shrink: 0;
    font-size: 1.25rem;
    color: var(--md-sys-color-on-surface-variant);
  }

  .device-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .device-name {
    font-size: 0.9375rem;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .device-ip {
    font-size: 0.75rem;
    color: var(--md-sys-color-on-surface-variant);
    margin-top: 1px;
  }

  .device-action {
    flex-shrink: 0;
    color: var(--md-sys-color-on-surface-variant);
    font-size: 1rem;
    display: flex;
    align-items: center;
  }
}

.nearby-spacer {
  min-height: 24px;
}

.nearby-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 28px 0 8px;
  color: var(--md-sys-color-on-surface-variant);

  .empty-icon {
    font-size: 2rem;
    opacity: 0.45;
  }

  p {
    margin: 0;
    font-size: 0.875rem;
  }
}
</style>
