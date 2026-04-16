<template>
  <v-dropdown v-model="open">
    <template #trigger>
      <span class="nowrap">{{ id }}</span>
    </template>
    <pre class="view-raw">{{ raw }}</pre>
  </v-dropdown>
</template>
<script setup lang="ts">
import { ref } from 'vue'
defineProps({
  id: { type: [String, Number], required: true },
  raw: { type: [String, Object], default: '' },
})
const open = ref(false)
</script>
