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
  disabled: { type: Boolean, default: false }
})

</script>

<style scoped>
.v-outlined-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid var(--md-sys-color-outline, #79747E);
  border-radius: 20px;
  padding: 10px 24px;
  background-color: transparent;
  color: var(--md-sys-color-primary, #6750A4);
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.1px;
  text-decoration: none;
  cursor: pointer;
  transition: box-shadow 0.2s;
  height: 40px;
  min-width: 64px;
  position: relative;
  overflow: hidden;
}

.v-outlined-button:disabled {
  border-color: rgba(0, 0, 0, 0.12);
  color: rgba(0, 0, 0, 0.38);
  cursor: default;
  box-shadow: none;
}
</style> 