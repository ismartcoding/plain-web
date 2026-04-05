<template>
  <div class="ux-item">
    <div class="ux-demo">
      <slot />
    </div>
    <pre class="ux-code"><code>{{ code }}</code></pre>
  </div>
</template>

<script setup lang="ts">
defineProps<{ code: string }>()
</script>

<style scoped lang="scss">
.ux-item {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  padding: 12px 0;
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
}

.ux-demo {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-width: 200px;
}

.ux-code {
  flex: 1;
  margin: 0;
  padding: 8px 12px;
  background: var(--md-sys-color-surface-container);
  border-radius: 8px;
  font-size: 0.75rem;
  line-height: 1.5;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
  min-width: 200px;

  code {
    font-family: 'Fira Code', 'Consolas', monospace;
    color: var(--md-sys-color-on-surface);
  }
}
</style>
