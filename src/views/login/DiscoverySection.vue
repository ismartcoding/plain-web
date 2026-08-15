<template>
  <div>
    <DeviceDiscoveryStatus
      :status="status"
      @retry="retry"
      @open-settings="openLanPermissionSettings"
    />
    <ul v-if="devices.length > 0" class="list-items discovery-list">
      <DiscoverItem
        v-for="d in devices"
        :key="d.id"
        :name="d.name"
        :host="deviceHost(d)"
        :disabled="connecting"
        @select="select(d)"
      />
    </ul>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import DiscoverItem from './DiscoverItem.vue'
import DeviceDiscoveryStatus from '@/components/DeviceDiscoveryStatus.vue'
import { useDeviceDiscovery } from '@/hooks/use-device-discovery'
import type { DiscoveredDevice } from '@/hooks/use-device-discovery'

defineProps<{
  connecting?: boolean
}>()

const emit = defineEmits<{
  (e: 'device-selected', host: string): void
}>()

const { devices, status, start, stop, retry, openLanPermissionSettings } = useDeviceDiscovery()

onMounted(() => {
  start()
})

onUnmounted(() => {
  stop()
})

function deviceHost(d: DiscoveredDevice): string {
  return `${d.ips[0]}:${d.port}`
}

function select(d: DiscoveredDevice) {
  emit('device-selected', deviceHost(d))
}
</script>

