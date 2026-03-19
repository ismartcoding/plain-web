<template>
  <div class="toggle-group" role="tablist" :aria-label="$t('editor_view')">
    <button
      class="toggle-btn"
      :class="{ active: mode === 'editor' }"
      type="button"
      @click="$emit('update:mode', 'editor')"
    >
      <i-lucide:pencil />
    </button>
    <button
      class="toggle-btn"
      :class="{ active: mode === 'preview' }"
      type="button"
      @click="$emit('update:mode', 'preview')"
    >
      <i-lucide:eye />
    </button>
  </div>
</template>

<script setup lang="ts">
import type { ViewMode } from '@/hooks/note-edit'

defineProps<{ mode: ViewMode }>()
defineEmits<{ (e: 'update:mode', value: ViewMode): void }>()
</script>

<style scoped lang="scss">
.toggle-group {
  display: inline-flex;
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: 999px;
  overflow: hidden;
  background: var(--md-sys-color-surface-container-low);
}

.toggle-btn {
  border: none;
  background: transparent;
  color: var(--md-sys-color-on-surface-variant);
  padding: 6px 12px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.82rem;
  cursor: pointer;
}

.toggle-btn.active {
  background: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
}
</style>
