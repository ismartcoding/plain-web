<template>
  <div class="surface-card">
    <div class="progress-card-info">
      <span v-html="labelHtml" />
      <span class="progress-card-pct">{{ value }}%</span>
    </div>
    <div class="progress-track">
      <div class="progress-fill" :style="{ width: value + '%' }" />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ labelHtml: string; value: number }>()
</script>

<style lang="scss" scoped>
.progress-card-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 0.8rem;
  color: var(--md-sys-color-on-surface);

  :deep(b) {
    color: var(--md-sys-color-primary);
    font-weight: 600;
  }
}

.progress-card-pct {
  color: var(--md-sys-color-on-surface-variant);
}
</style>
