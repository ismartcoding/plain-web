<template>
  <i-lucide:smartphone v-if="deviceType === 'PHONE'" />
  <i-lucide:tablet v-else-if="deviceType === 'TABLET'" />
  <i-lucide:laptop v-else-if="deviceType === 'PC'" />
  <i-lucide:tv v-else-if="deviceType === 'TV'" />
  <i-lucide:monitor-smartphone v-else />
</template>

<script setup lang="ts">
defineProps<{
  deviceType?: string
}>()
</script>
