<template>
  <button 
    class="v-filter-chip" 
    :class="{ selected }"
    @click="$emit('click', $event)"
  >
    <span class="chip-label">{{ label }}</span>
  </button>
</template>

<script setup lang="ts">
interface Props {
  label: string
  selected?: boolean
}

withDefaults(defineProps<Props>(), {
  selected: false
})

defineEmits<{
  click: [event: Event]
}>()
</script>

<style scoped>
.v-filter-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  padding: 0 16px;
  border-radius: 16px;
  border: none;
  background-color: var(--md-sys-color-surface-container);
  color: var(--md-sys-color-on-surface-variant);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  user-select: none;
  outline: none;
  white-space: nowrap;
  min-width: 0;
  box-sizing: border-box;
  border: 1px solid var(--md-sys-color-outline);
  transition: background-color 0.15s ease, color 0.15s ease, transform 0.1s ease;
}

.v-filter-chip:hover:not(.selected) {
  background-color: var(--md-sys-color-surface-container-high);
  color: var(--md-sys-color-on-surface);
}

.v-filter-chip.selected {
  background-color: var(--md-sys-color-secondary-container);
  color: var(--md-sys-color-on-secondary-container);
  font-weight: 500;
}

.v-filter-chip.selected:hover {
  background-color: color-mix(in srgb, var(--md-sys-color-secondary-container) 92%, var(--md-sys-color-on-secondary-container));
}

.v-filter-chip:focus-visible {
  outline: 2px solid var(--md-sys-color-primary);
  outline-offset: 2px;
}

.v-filter-chip:active {
  transform: scale(0.98);
}

.chip-label {
  pointer-events: none;
}
</style> 