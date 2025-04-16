<template>
  <button class="btn-icon" :disabled="loading">
    <md-ripple />
    <md-circular-progress v-if="loading" indeterminate />
    <slot v-else name="icon" />
  </button>
</template>
<script setup lang="ts">
defineProps({
  loading: { type: Boolean },
})
</script>
