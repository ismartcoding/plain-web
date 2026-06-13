<template>
  <li :class="{ active }" @click.prevent="emit('click', $event)">
    <span v-if="$slots.start" class="start">
      <slot name="start" />
    </span>

    <div class="body">
      <span class="title" :title="title">
        <slot name="title">{{ title }}</slot>
      </span>
      <span v-if="hasSubtitle" class="subtitle" :title="subtitle">
        <slot name="subtitle">{{ subtitle }}</slot>
      </span>
    </div>

    <span v-if="$slots.end" class="end">
      <slot name="end" />
    </span>
  </li>
</template>

<script setup lang="ts">
import { computed, useSlots } from 'vue'

const props = withDefaults(
  defineProps<{
    title: string
    subtitle?: string
    active?: boolean
  }>(),
  {
    active: false,
    subtitle: '',
  },
)

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void
}>()

const slots = useSlots()
const hasSubtitle = computed(() => !!slots.subtitle || !!props.subtitle)
</script>

<style lang="scss" scoped>
.body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.start {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
}

.end {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  gap: 4px;
}

.subtitle {
  font-size: 0.75rem;
  opacity: 0.78;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 4px;
}
</style>
