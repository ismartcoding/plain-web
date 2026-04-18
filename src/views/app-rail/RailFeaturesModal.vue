<template>
  <v-modal @close="close">
    <template #headline>{{ $t('customize_sidebar') }}</template>
    <template #content>
      <div class="features-list">
        <div v-if="enabledIds.length > 1" class="drag-hint">
          {{ $t('drag_to_reorder') }}
        </div>
        <div
          v-for="(item, idx) in displayList"
          :key="item.feat.id"
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
          <component :is="item.feat.icon" class="feat-icon" />
          <span class="feat-name">{{ $t(item.feat.titleKey) }}</span>
          <label class="feat-switch">
            <input type="checkbox" :checked="item.enabled" @change="toggle(item.feat.id)" />
            <span class="switch-track"></span>
          </label>
        </div>
      </div>
    </template>
    <template #actions>
      <v-outlined-button @click="close">{{ $t('cancel') }}</v-outlined-button>
      <v-filled-button @click="save">{{ $t('save') }}</v-filled-button>
    </template>
  </v-modal>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { popModal } from '@/components/modal'
import { useMainStore } from '@/stores/main'
import { useTempStore } from '@/stores/temp'
import { storeToRefs } from 'pinia'
import { getAvailableFeatures, type Feature } from './features'

const store = useMainStore()
const { app } = storeToRefs(useTempStore())

const available = computed(() => getAvailableFeatures(app.value?.channel ?? ''))

const enabledIds = ref<string[]>(
  store.railFeatures.filter((id: string) => available.value.some((f) => f.id === id))
)

const displayList = computed(() => {
  const enabled = enabledIds.value
    .map((id) => available.value.find((f) => f.id === id))
    .filter((f): f is Feature => !!f)
    .map((feat) => ({ feat, enabled: true }))
  const disabled = available.value
    .filter((f) => !enabledIds.value.includes(f.id))
    .map((feat) => ({ feat, enabled: false }))
  return [...enabled, ...disabled]
})

const dragIndex = ref(-1)
const dragOverIndex = ref(-1)

function onDragStart(index: number, e: DragEvent) {
  dragIndex.value = index
  e.dataTransfer!.effectAllowed = 'move'
  e.dataTransfer!.setData('text/plain', String(index))
}

function onDragOver(index: number) {
  if (index < enabledIds.value.length) {
    dragOverIndex.value = index
  } else {
    dragOverIndex.value = -1
  }
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
  ids.splice(toIndex, 0, moved)
  enabledIds.value = ids
}

function onDragEnd() {
  dragIndex.value = -1
  dragOverIndex.value = -1
}

function toggle(id: string) {
  if (enabledIds.value.includes(id)) {
    enabledIds.value = enabledIds.value.filter((x) => x !== id)
  } else {
    enabledIds.value = [...enabledIds.value, id]
  }
}

function save() {
  store.railFeatures = [...enabledIds.value]
  popModal()
}

function close() {
  popModal()
}
</script>

<style lang="scss" scoped>
.features-list {
  display: flex;
  flex-direction: column;
  min-width: 300px;
  max-height: 70vh;
  overflow-y: auto;
  padding: 4px 0;
}

.feature-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  cursor: default;
  border-top: 2px solid transparent;
  transition: border-color 0.15s;

  &.enabled {
    cursor: grab;
    &:active { cursor: grabbing; }
  }

  &.drag-over {
    border-top-color: var(--md-sys-color-primary);
  }
}

.feat-order {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--md-sys-color-surface-container);
  color: var(--md-sys-color-on-surface-variant);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 500;
  flex-shrink: 0;

  .enabled & {
    background: color-mix(in srgb, var(--md-sys-color-primary) 15%, transparent);
    color: var(--md-sys-color-primary);
  }
}

.feat-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  color: var(--md-sys-color-on-surface-variant);

  .enabled & { color: var(--md-sys-color-primary); }
}

.feat-name {
  flex: 1;
  font-size: 15px;
  color: var(--md-sys-color-on-surface-variant);

  .enabled & {
    color: var(--md-sys-color-on-surface);
    font-weight: 500;
  }
}

.feat-switch {
  cursor: pointer;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;

  input {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
  }
}

.switch-track {
  width: 52px;
  height: 32px;
  border-radius: 16px;
  background: var(--md-sys-color-surface-container-highest);
  position: relative;
  transition: background 0.25s;

  &::after {
    content: '';
    position: absolute;
    top: 4px;
    left: 4px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--md-sys-color-outline);
    transition: transform 0.25s, background 0.25s;
  }
}

input:checked + .switch-track {
  background: var(--md-sys-color-primary);

  &::after {
    transform: translateX(20px);
    background: var(--md-sys-color-on-primary);
  }
}
.drag-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--md-sys-color-outline);
  padding: 0 4px 8px;
}

.drag-hint-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}
</style>