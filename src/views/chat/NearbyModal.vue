<template>
  <v-modal width="480px" @close="handleClose">
    <template #headline>
      <v-circular-progress indeterminate class="sm" aria-label="scanning" />
      <span>{{ $t('scanning_devices') }}</span>
    </template>
    <template #content>
      <div v-if="discoveredDevices.length === 0" class="nearby-empty">
        <p>{{ $t('same_network_hint') }}</p>
      </div>

      <ul v-else class="card list-items">
        <VListItem v-for="d in discoveredDevices" :key="d.id" :subtitle="d.ips.join(', ')">
          <template #title>
            <span>{{ d.name }}</span>
            <i-lucide:bluetooth
v-if="d.discoveryMethods.includes('BLE')" v-tooltip="$t('discovered_via_bluetooth')"
              class="discovery-icon" />
            <i-lucide:wifi
v-if="d.discoveryMethods.includes('LAN')" v-tooltip="$t('discovered_via_lan')"
              class="discovery-icon" />
            <span v-if="d.status === 'PAIRING'" v-tooltip="$t('waiting_for_confirmation')" class="status-badge warn">{{
              $t('pending') }}</span>
          </template>
          <template #start>
            <DeviceTypeIcon :device-type="d.deviceType" />
          </template>
          <template #end>
            <v-outlined-button
v-if="d.status === 'PAIRING'" class="btn-sm danger"
              :loading="deviceStates.get(d.id) === 'canceling'" @click.stop="cancel(d)">
              {{ $t('cancel') }}
            </v-outlined-button>
            <v-outlined-button
v-else-if="d.status === 'UNPAIRING' || d.status === 'PAIRED'" class="btn-sm danger"
              :loading="deviceStates.get(d.id) === 'unpairing'" @click.stop="unpair(d)">
              {{ $t('unpair') }}
            </v-outlined-button>
            <v-outlined-button
v-else class="btn-sm" :loading="deviceStates.get(d.id) === 'pairing'"
              @click.stop="startPair(d)">
              {{ $t('pair') }}
            </v-outlined-button>
          </template>
        </VListItem>
      </ul>
    </template>
    <template #actions>
      <v-outlined-button @click="handleClose">{{ $t('close') }}</v-outlined-button>
    </template>
  </v-modal>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { popModal } from '@/components/modal'
import { useDeviceDiscovery, type DiscoveredDevice } from '@/hooks/use-device-discovery'
import { useDevicePairing } from '@/hooks/use-device-pairing'
import { unpairPeerGQL, initMutation } from '@/lib/api/mutation'
import { useChatStore } from '@/stores/chat'

const {
  devices: discoveredDevices,
  start,
  stop,
} = useDeviceDiscovery()
const {
  deviceStates,
  pairDevice,
  cancelPairing,
} = useDevicePairing()

const chatStore = useChatStore()


async function startPair(d: DiscoveredDevice) {
  deviceStates.set(d.id, 'pairing')
  await pairDevice({
    id: d.id,
    name: d.name,
    ips: d.ips,
    port: d.port,
    deviceType: d.deviceType,
    version: d.version,
    platform: d.platform,
    lastSeen: d.lastSeen,
    discoveryMethods: d.discoveryMethods,
  })
  d.status = 'PAIRING'
  deviceStates.delete(d.id)
}

async function cancel(d: DiscoveredDevice) {
  deviceStates.set(d.id, 'canceling')
  await cancelPairing(d.id)
  d.status = 'UNPAIRED'
  deviceStates.delete(d.id)
}

const { mutate: unpairPeerMute } = initMutation({ document: unpairPeerGQL })

async function unpair(d: DiscoveredDevice) {
  deviceStates.set(d.id, 'unpairing')
  const result = await unpairPeerMute({ id: d.id })
  if (result) {
    d.status = 'UNPAIRED'
    deviceStates.set(d.id, 'unpaired')
    await chatStore.fetchPeers()
  }
  deviceStates.delete(d.id)
}

function handleClose() {
  stop()
  popModal()
}

onMounted(() => {
  start()
  chatStore.fetchPeers()
})

onBeforeUnmount(() => {
  stop()
})
</script>

<style lang="scss" scoped>
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
</style>
