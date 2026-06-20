<template>
  <v-modal width="480px" @close="handleClose">
    <template #headline>
      <v-circular-progress
        indeterminate
        class="sm"
        aria-label="scanning"
      />
      <span>{{ $t('scanning_devices') }}</span>
    </template>
    <template #content>
      <div v-if="discoveredDevices.length === 0" class="nearby-empty">
        <p>{{ $t('same_network_hint') }}</p>
      </div>

      <ul v-else class="card list-items">
        <VListItem
          v-for="d in discoveredDevices"
          :key="d.id"
          :title="d.name"
          :subtitle="d.ip"
          :active="pendingIds.has(d.id)"
        >
          <template #start>
            <DeviceTypeIcon :device-type="d.deviceType" />
          </template>
          <template #end>
            <template v-if="pendingIds.has(d.id)">
              <span v-tooltip="$t('waiting_for_confirmation')" class="status-badge warn">{{ $t('pending') }}</span>
              <v-outlined-button
                class="btn-sm"
                :loading="pairingStatusMap.get(d.id) === 'requesting'"
                @click.stop="cancel(d)"
              >
                {{ $t('cancel') }}
              </v-outlined-button>
            </template>
            <v-outlined-button
              v-else-if="isPaired(d.id)"
              class="btn-sm danger"
              :loading="unpairingIds.has(d.id)"
              @click.stop="unpair(d)"
            >
              {{ $t('unpair') }}
            </v-outlined-button>
            <v-outlined-button
              v-else
              class="btn-sm"
              :loading="loadingPairIds.has(d.id)"
              @click.stop="startPair(d)"
            >
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
import { computed, onBeforeUnmount, onMounted, reactive, watch } from 'vue'
import { popModal } from '@/components/modal'
import { useDeviceDiscovery, type DiscoveredDevice } from '@/hooks/use-device-discovery'
import { useDevicePairing } from '@/hooks/use-device-pairing'
import { deletePeerGQL, initMutation } from '@/lib/api/mutation'
import { useChatStore } from '@/stores/chat'

const {
  devices: discoveredDevices,
  start,
  stop,
} = useDeviceDiscovery()
const {
  pairingStatusMap,
  pairDevice,
  cancelPairing,
} = useDevicePairing()

const chatStore = useChatStore()
const { peers } = chatStore

const pendingIds = reactive(new Set<string>())
const loadingPairIds = reactive(new Set<string>())
const unpairingIds = reactive(new Set<string>())

const pairedIdSet = computed(() => {
  const set = new Set<string>()
  for (const p of peers) {
    if (p.status === 'paired') set.add(p.id)
  }
  return set
})

function isPaired(deviceId: string): boolean {
  return pairedIdSet.value.has(deviceId)
}

async function startPair(d: DiscoveredDevice) {
  if (pendingIds.has(d.id) || loadingPairIds.has(d.id)) return
  loadingPairIds.add(d.id)
  try {
    await pairDevice({
      id: d.id,
      name: d.name,
      ips: d.ips && d.ips.length > 0 ? d.ips : [d.ip],
      port: d.port,
      deviceType: d.deviceType,
      version: d.version ?? '',
      platform: d.platform ?? '',
      lastSeen: d.lastSeen ?? '',
    })
  } finally {
    loadingPairIds.delete(d.id)
  }
  pendingIds.add(d.id)
}

async function cancel(d: DiscoveredDevice) {
  if (!pendingIds.has(d.id)) return
  await cancelPairing(d.id)
  pendingIds.delete(d.id)
}

const { mutate: deletePeerMutate } = initMutation({ document: deletePeerGQL })

async function unpair(d: DiscoveredDevice) {
  if (unpairingIds.has(d.id)) return
  unpairingIds.add(d.id)
  try {
    const result = await deletePeerMutate({ id: d.id })
    if (result) {
      await chatStore.fetchPeers()
    }
  } finally {
    unpairingIds.delete(d.id)
  }
}

function handleClose() {
  for (const id of pendingIds) {
    cancelPairing(id)
  }
  stop()
  popModal()
}

watch(pairingStatusMap, (map) => {
  for (const [deviceId, status] of map) {
    if (!pendingIds.has(deviceId)) continue
    if (status === 'success') {
      popModal()
      return
    }
    if (status === 'failed' || status === 'cancelled') {
      pendingIds.delete(deviceId)
      map.delete(deviceId)
    }
  }
})

onMounted(() => {
   start()
   chatStore.fetchPeers()
})

onBeforeUnmount(() => {
  for (const id of pendingIds) {
    cancelPairing(id)
  }
  stop()
})
</script>

<style lang="scss" scoped>
.nearby-empty {
  padding-inline: 16px;
  text-align: center;
  color: var(--md-sys-color-on-surface-variant);
}
</style>
