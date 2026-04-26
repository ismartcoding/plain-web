<template>
  <div class="features-list">
    <div class="drag-hint">
      {{ $t('drag_to_reorder') }}
    </div>

    <div
      v-for="(item, idx) in displayList"
      :key="item.feature.id"
      class="feature-row"
      :class="{ enabled: item.enabled, 'drag-over': dragOverIndex === idx && item.enabled }"
      :draggable="item.enabled"
      @dragstart="onDragStart(idx, $event)"
      @dragover.prevent="onDragOver(idx)"
      @dragleave="onDragLeave"
      @drop.prevent="onDrop(idx)"
      @dragend="onDragEnd"
    >
      <div class="feat-order">{{ item.enabled ? idx + 1 : '—' }}</div>
      <component :is="item.feature.icon" class="feat-icon" />
      <span class="feat-name">{{ $t(item.feature.titleKey) }}</span>
      <label class="feat-switch" :class="{ disabled: item.enabled && enabledIds.length === 1 }">
        <input type="checkbox" :checked="item.enabled" :disabled="item.enabled && enabledIds.length === 1" @change="toggle(item.feature.id)" />
        <span class="switch-track"></span>
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, type Component } from 'vue'

interface CustomizableFeature {
  id: string
  icon: Component
  titleKey: string
}

const props = defineProps<{
  features: CustomizableFeature[]
  modelValue: string[]
}>()

const emit = defineEmits<{
  'update:modelValue': [ids: string[]]
}>()

const enabledIds = computed({
  get: () => props.modelValue.filter((id) => props.features.some((f) => f.id === id)),
  set: (ids: string[]) => emit('update:modelValue', ids),
})

const displayList = computed(() => {
  const featureMap = new Map(props.features.map((feature) => [feature.id, feature]))
  const enabled = enabledIds.value
    .map((id) => featureMap.get(id))
    .filter((feature): feature is CustomizableFeature => !!feature)
    .map((feature) => ({ feature, enabled: true }))
  const disabled = props.features
    .filter((feature) => !enabledIds.value.includes(feature.id))
    .map((feature) => ({ feature, enabled: false }))
  return [...enabled, ...disabled]
})

const dragIndex = ref(-1)
const dragOverIndex = ref(-1)

function onDragStart(index: number, e: DragEvent) {
  dragIndex.value = index
  if (!e.dataTransfer) return
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', String(index))
}

function onDragOver(index: number) {
  dragOverIndex.value = index < enabledIds.value.length ? index : -1
}

function onDragLeave() {
  dragOverIndex.value = -1
}

function onDrop(toIndex: number) {
  dragOverIndex.value = -1
  const fromIndex = dragIndex.value
  if (fromIndex < 0 || fromIndex === toIndex || toIndex >= enabledIds.value.length) return
  const ids = [...enabledIds.value]
  const [moved] = ids.splice(fromIndex, 1)
  if (!moved) return
  ids.splice(toIndex, 0, moved)
  enabledIds.value = ids
}

function onDragEnd() {
  dragIndex.value = -1
  dragOverIndex.value = -1
}

function toggle(id: string) {
  enabledIds.value = enabledIds.value.includes(id)
    ? enabledIds.value.filter((value) => value !== id)
    : [...enabledIds.value, id]
}
</script>

<style lang="scss" scoped src="./FeatureSortToggleList.scss"></style>
