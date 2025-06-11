<template>
  <button class="btn-icon" :disabled="loading">
    <v-circular-progress v-if="loading" indeterminate class="sm" />
    <slot v-else />
  </button>
</template>
<script setup lang="ts">
defineProps({
  loading: { type: Boolean },
})
</script>
