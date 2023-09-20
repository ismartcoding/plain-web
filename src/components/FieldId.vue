<template>
  <popper>
    <span class="nowrap">{{ id }}</span>
    <template #content>
      <pre class="view-raw">{{ raw }}</pre>
    </template>
  </popper>
</template>
<script setup lang="ts">
defineProps({
  id: { type: String, required: true },
  raw: { type: [String, Object], default: '' },
})
</script>
