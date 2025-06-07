<template>
  <div
    class="v-input-chip"
    :class="{
      'v-input-chip--selected': selected,
      'v-input-chip--disabled': disabled,
      'v-input-chip--remove-only': removeOnly
    }"
    :tabindex="disabled ? -1 : 0"
    @click="handleClick"
    @keydown="handleKeydown"
  >
    <span v-if="$slots.default" class="v-input-chip__icon">
      <slot></slot>
    </span>
    <span class="v-input-chip__label">{{ label }}</span>
    <button
      class="v-input-chip__remove"
      type="button"
      :disabled="disabled"
      :aria-label="ariaLabelRemove || 'Remove'"
      @click.stop="handleRemove"
    >
      <svg viewBox="0 0 24 24" width="18" height="18">
        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
interface Props {
  label?: string
  selected?: boolean
  disabled?: boolean
  removeOnly?: boolean
  ariaLabelRemove?: string
}

const props = withDefaults(defineProps<Props>(), {
  label: '',
  selected: false,
  disabled: false,
  removeOnly: false,
  ariaLabelRemove: ''
})

const emit = defineEmits<{
  remove: []
  click: []
}>()

function handleClick() {
  if (!props.disabled && !props.removeOnly) {
    emit('click')
  }
}

function handleRemove() {
  if (!props.disabled) {
    emit('remove')
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    handleClick()
  }
}
</script>

<style scoped>
.v-input-chip {
  display: inline-flex;
  align-items: center;
  height: 32px;
  padding: 0 8px 0 12px;
  border: 1px solid var(--md-sys-color-outline);
  border-radius: 8px;
  background-color: var(--md-sys-color-surface-container-low);
  color: var(--md-sys-color-on-surface);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  user-select: none;
  outline: none;
  box-sizing: border-box;
  gap: 8px;
  transition: all 0.2s ease;
}

.v-input-chip:hover:not(.v-input-chip--disabled) {
  background-color: var(--md-sys-color-surface-container);
  border-color: var(--md-sys-color-outline-variant);
}

.v-input-chip:focus-visible {
  border-color: var(--md-sys-color-primary);
  outline: 2px solid var(--md-sys-color-primary);
  outline-offset: 2px;
}

.v-input-chip--selected {
  background-color: var(--md-sys-color-secondary-container);
  border-color: var(--md-sys-color-secondary-container);
  color: var(--md-sys-color-on-secondary-container);
}

.v-input-chip--selected:hover:not(.v-input-chip--disabled) {
  background-color: var(--md-sys-color-secondary-container);
  opacity: 0.9;
}

.v-input-chip--disabled {
  opacity: 0.38;
  cursor: default;
  pointer-events: none;
}

.v-input-chip--remove-only {
  cursor: default;
}

.v-input-chip__icon {
  display: flex;
  align-items: center;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  color: var(--md-sys-color-on-surface-variant);
}

.v-input-chip--selected .v-input-chip__icon {
  color: var(--md-sys-color-on-secondary-container);
}

.v-input-chip__icon svg,
.v-input-chip__icon [class*="i-"] {
  width: 18px;
  height: 18px;
  fill: currentColor;
  color: currentColor;
}

.v-input-chip__label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.v-input-chip__remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  background: none;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  color: var(--md-sys-color-on-surface-variant);
  flex-shrink: 0;
  transition: background-color 0.2s ease;
}

.v-input-chip--selected .v-input-chip__remove {
  color: var(--md-sys-color-on-secondary-container);
}

.v-input-chip__remove:hover:not(:disabled) {
  background-color: var(--md-sys-color-surface-container-highest);
}

.v-input-chip--selected .v-input-chip__remove:hover:not(:disabled) {
  background-color: rgba(0, 0, 0, 0.08);
}

.v-input-chip__remove:disabled {
  cursor: default;
  opacity: 0.38;
}

.v-input-chip__remove svg {
  width: 18px;
  height: 18px;
  fill: currentColor;
  pointer-events: none;
}
</style> 