<template>
  <button class="outlined-button" v-bind="$attrs" :disabled="disabled || loading">
    <md-ripple />
    <span v-if="loading" class="loading-spinner"></span>
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
.outlined-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
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

.outlined-button:disabled {
  border-color: rgba(0, 0, 0, 0.12);
  color: rgba(0, 0, 0, 0.38);
  cursor: default;
  box-shadow: none;
}

.outlined-button:disabled md-ripple {
  display: none;
}

.loading-spinner {
  display: inline-block;
  width: 18px;
  height: 18px;
  border: 2px solid rgba(103, 80, 164, 0.3);
  border-radius: 50%;
  border-top-color: var(--md-sys-color-primary, #6750A4);
  animation: spin 1s ease-in-out infinite;
  margin-right: 8px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style> 