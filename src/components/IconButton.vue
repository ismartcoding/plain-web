<template>
  <button class="btn-icon" :disabled="loading">
    <md-ripple />
    <md-circular-progress indeterminate v-if="loading" />
    <slot name="icon" v-else />
  </button>
</template>
<script setup lang="ts">
defineProps({
  loading: { type: Boolean },
})
</script>
