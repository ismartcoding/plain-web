<template>
  <li :class="{ active, clickable, 'has-actions': hasActions, 'force-actions': forceActions }" @click.prevent="emit('click', $event)">
    <span v-if="$slots.start" class="start">
      <slot name="start" />
    </span>

    <div class="body">
      <span v-if="hasTitle" class="title" :title="title">
        <slot name="title">{{ title }}</slot>
      </span>
      <span v-if="hasSubtitle" class="subtitle" :title="subtitle">
        <slot name="subtitle">{{ subtitle }}</slot>
      </span>
    </div>

    <span v-if="$slots.end || hasValue" class="end">
      <span v-if="hasValue" class="value" :title="value">
        <slot name="value">{{ value }}</slot>
      </span>
      <slot name="end" />
    </span>
    <span v-if="hasActions" class="actions">
      <slot name="actions" />
    </span>
  </li>
</template>

<script setup lang="ts">
import { computed, useSlots } from 'vue'

const props = withDefaults(
  defineProps<{
    title?: string
    subtitle?: string
    value?: string
    active?: boolean
    clickable?: boolean
    forceActions?: boolean
  }>(),
  {
    title: '',
    subtitle: '',
    value: '',
    active: false,
    clickable: false,
    forceActions: false,
  },
)

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void
}>()

const slots = useSlots()
const hasTitle = computed(() => !!slots.title || !!props.title)
const hasSubtitle = computed(() => !!slots.subtitle || !!props.subtitle)
const hasValue = computed(() => !!slots.value || !!props.value)
const hasActions = computed(() => !!slots.actions)
</script>

<style lang="scss" scoped>
li {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 44px;
  padding: 8px 16px;
  box-sizing: border-box;
}

.start {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
}

.body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
}

.title {
  color: var(--md-sys-color-on-surface);
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
}

.subtitle {
  font-size: 0.75rem;
  color: var(--md-sys-color-on-surface-variant);
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
}

.title,
.end,
.actions {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  gap: 4px;
}

.active {
  background: var(--md-sys-color-surface-variant);
}

.clickable {
  cursor: pointer;
}

.clickable:hover {
  background: var(--md-sys-color-surface-container);
}
</style>
