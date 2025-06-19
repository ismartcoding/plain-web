<template>
  <button class="v-outlined-button" :disabled="disabled || loading">
    <v-circular-progress v-if="loading" indeterminate class="sm" />
    <slot name="icon"></slot>
    <slot></slot>
  </button>
</template>

<script setup lang="ts">
defineProps({
  loading: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
})
</script>

