<template>
  <div class="file-info-item">
    <div class="info-item-label">
      <slot name="label">{{ label }}</slot>
    </div>
    <div class="info-item-value">
      <slot>{{ value }}</slot>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps({
  label: {
    type: String,
    default: '',
  },
  value: {
    type: String,
    default: '',
  },
  isPath: {
    type: Boolean,
    default: false,
  },
})
</script>

<style lang="scss" scoped>
.file-info-item {
  margin-bottom: 16px;
}

.info-item-label {
  color: var(--md-sys-color-primary);
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  font-weight: 500;
}

.info-item-value {
  word-break: break-word;
}
</style> 