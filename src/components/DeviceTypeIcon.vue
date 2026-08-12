<template>
  <i-lucide:smartphone v-if="deviceType === DeviceType.PHONE" />
  <i-lucide:tablet v-else-if="deviceType === DeviceType.TABLET" />
  <i-lucide:laptop v-else-if="deviceType === DeviceType.COMPUTER" />
  <i-lucide:tv v-else-if="deviceType === DeviceType.TV" />
  <i-lucide:monitor-smartphone v-else />
</template>

<script setup lang="ts">
import { DeviceType } from '@/lib/status'

defineProps<{
  deviceType?: DeviceType
}>()
</script>
