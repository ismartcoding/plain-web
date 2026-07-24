<template>
  <i-lucide:smartphone v-if="deviceType === 'phone'" />
  <i-lucide:tablet v-else-if="deviceType === 'tablet'" />
  <i-lucide:laptop v-else-if="deviceType === 'computer'" />
  <i-lucide:tv v-else-if="deviceType === 'tv'" />
  <i-lucide:monitor-smartphone v-else />
</template>

<script setup lang="ts">
defineProps<{
  deviceType?: string
}>()
</script>
