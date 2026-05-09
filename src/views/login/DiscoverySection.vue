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
        :key="d.host"
        :name="d.name"
        :host="d.host"
        :disabled="connecting"
        @select="select(d.host)"
      />
    </ul>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import DiscoverItem from './DiscoverItem.vue'
import DeviceDiscoveryStatus from '@/components/DeviceDiscoveryStatus.vue'
import { useDeviceDiscovery } from '@/hooks/use-device-discovery'

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

function select(host: string) {
  emit('device-selected', host)
}
</script>

<style lang="scss" scoped>
.discovery-list {
  margin-bottom: 0;
}
</style>
