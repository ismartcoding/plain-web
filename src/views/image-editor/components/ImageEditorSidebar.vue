<template>
  <div class="sidebar-sections">
    <div class="section">
      <label class="section-label">{{ $t('image_editor.canvas_size') }}</label>
      <div class="presets">
        <button
          v-for="p in presets"
          :key="p.label"
          class="preset-btn"
          :class="{ active: isPresetActive(p) }"
          @click="emit('resize', p.w, p.h)"
        >
          {{ p.label }}
        </button>
      </div>
      <div class="size-inputs">
        <div class="size-input">
          <span class="size-label">W</span>
          <input
            :value="canvasWidth"
            type="number"
            min="1"
            max="8000"
            class="size-field"
            @change="onCustomSize(($event.target as HTMLInputElement).value, 'w')"
          />
        </div>
        <i-lucide-x class="size-sep" />
        <div class="size-input">
          <span class="size-label">H</span>
          <input
            :value="canvasHeight"
            type="number"
            min="1"
            max="8000"
            class="size-field"
            @change="onCustomSize(($event.target as HTMLInputElement).value, 'h')"
          />
        </div>
      </div>
    </div>

    <div class="section">
      <div class="layers-header">
        <label class="section-label">{{ $t('image_editor.layers') }}</label>
        <div ref="addDropdownRef" class="add-wrap">
          <button
            v-if="layers.length < 10"
            class="add-btn"
            @click="showAddDropdown = !showAddDropdown"
          >
            <i-lucide-plus />
            {{ $t('image_editor.add') }}
            <i-lucide-chevron-down />
          </button>
          <Transition name="dropdown">
            <div v-if="showAddDropdown" class="add-menu">
              <button class="add-item" @click="handleAddText">
                <i-lucide-type />
                {{ $t('image_editor.add_text') }}
              </button>
              <button class="add-item" @click="triggerImageUpload">
                <i-lucide-image />
                {{ $t('image_editor.add_image') }}
              </button>
              <button class="add-item" @click="handleAddSticker">
                <i-lucide-sticky-note />
                {{ $t('image_editor.add_note') }}
              </button>
            </div>
          </Transition>
          <input ref="imageInputRef" type="file" accept="image/*" class="hidden-input" @change="onImageFileChange" />
        </div>
      </div>

      <div v-if="!layers.length" class="empty-layers">
        {{ $t('image_editor.no_layers') }}
      </div>
      <div v-else class="layer-list">
        <div
          v-for="(layer, idx) in reversedLayers"
          :key="layer.id"
          class="layer-item-wrap"
        >
          <div
            v-if="dragOverIdx === realIndex(idx) && dragFromIdx !== realIndex(idx)"
            class="drop-indicator"
          />
          <div
            class="layer-item"
            :class="{ selected: layer.id === selectedLayerId }"
            draggable="true"
            @click="$emit('selectLayer', layer.id)"
            @dragstart="onDragStart(realIndex(idx), $event)"
            @dragover.prevent="onDragOver(realIndex(idx))"
            @dragleave="dragOverIdx = null"
            @drop.prevent="onDrop(realIndex(idx))"
            @dragend="onDragEnd"
          >
            <i-lucide-grip-vertical class="grip" />

            <template v-if="isEditorTextLayer(layer)">
              <div
                class="color-dot"
                :style="{ backgroundColor: layer.color }"
                @click.stop="$emit('openTextEditor', layer.id)"
              />
              <input
                v-model="layer.text"
                type="text"
                :placeholder="$t('image_editor.text_placeholder')"
                maxlength="200"
                class="layer-text-input"
                @click.stop
              />
              <button
                class="icon-action"
                @click.stop="$emit('openTextEditor', layer.id)"
              >
                <i-lucide-pencil />
              </button>
            </template>

            <template v-else-if="isEditorImageLayer(layer)">
              <i-lucide-image class="layer-type-icon" />
              <span class="layer-name">{{ layer.name }}</span>
              <label class="icon-action cursor-pointer">
                <i-lucide-arrow-left-right />
                <input type="file" accept="image/*" class="hidden-input" @change="onReplaceImage(layer.id, $event)" />
              </label>
            </template>

            <template v-else-if="layer.type === 'sticker'">
              <div
                class="sticker-dot"
                :style="{ backgroundColor: (layer as any).color }"
              />
              <span class="layer-name">{{ (layer as any).text || $t('image_editor.text_placeholder') }}</span>
            </template>

            <template v-else>
              <component :is="layerIcon(layer.type)" class="layer-type-icon" />
              <span class="layer-name" :class="{ 'line-through': !layer.visible }">{{ layer.name }}</span>
            </template>

            <button
              class="icon-action"
              @click.stop="$emit('toggleVisibility', layer.id)"
            >
              <i-lucide-eye v-if="layer.visible" />
              <i-lucide-eye-off v-else />
            </button>
            <button
              class="icon-action danger"
              @click.stop="$emit('removeLayer', realIndex(idx))"
            >
              <i-lucide-trash-2 />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import MoveUpRight from '~icons/lucide/move-up-right'
import Square from '~icons/lucide/square'
import Circle from '~icons/lucide/circle'
import Highlighter from '~icons/lucide/highlighter'
import Grid3x3 from '~icons/lucide/grid-3x3'
import Type from '~icons/lucide/type'
import Image from '~icons/lucide/image'
import Paintbrush from '~icons/lucide/paintbrush'
import StickyNote from '~icons/lucide/sticky-note'
import type { EditorLayer, EditorLayerType } from '@/views/image-editor/utils/types'
import { SIZE_PRESETS, isEditorTextLayer, isEditorImageLayer } from '@/views/image-editor/utils/types'

const props = defineProps<{
  canvasWidth: number
  canvasHeight: number
  layers: EditorLayer[]
  selectedLayerId: string | null
}>()

const emit = defineEmits<{
  resize: [w: number, h: number]
  selectLayer: [id: string]
  removeLayer: [idx: number]
  reorderLayer: [from: number, to: number]
  toggleVisibility: [id: string]
  addTextLayer: []
  addStickerLayer: []
  addImageFile: [file: File]
  replaceImageFile: [layerId: string, file: File]
  openTextEditor: [id: string]
}>()

const LAYER_ICONS: Record<EditorLayerType, any> = {
  arrow: MoveUpRight,
  rect: Square,
  ellipse: Circle,
  highlight: Highlighter,
  mosaic: Grid3x3,
  text: Type,
  image: Image,
  freehand: Paintbrush,
  sticker: StickyNote,
}

function layerIcon(type: EditorLayerType) {
  return LAYER_ICONS[type] ?? Square
}

const presets = SIZE_PRESETS
const reversedLayers = computed(() => [...props.layers].reverse())
function realIndex(reversedIdx: number) { return props.layers.length - 1 - reversedIdx }
function isPresetActive(p: { w: number; h: number }) { return props.canvasWidth === p.w && props.canvasHeight === p.h }
function onCustomSize(val: string, dim: 'w' | 'h') {
  const n = Math.max(1, Math.min(8000, parseInt(val) || 1))
  emit('resize', dim === 'w' ? n : props.canvasWidth, dim === 'h' ? n : props.canvasHeight)
}

const showAddDropdown = ref(false)
const addDropdownRef = ref<HTMLElement | null>(null)
const imageInputRef = ref<HTMLInputElement | null>(null)

function handleAddText() { emit('addTextLayer'); showAddDropdown.value = false }
function handleAddSticker() { emit('addStickerLayer'); showAddDropdown.value = false }
function triggerImageUpload() { showAddDropdown.value = false; imageInputRef.value?.click() }
function onImageFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  ;(e.target as HTMLInputElement).value = ''
  emit('addImageFile', file)
}
function onReplaceImage(layerId: string, e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  ;(e.target as HTMLInputElement).value = ''
  emit('replaceImageFile', layerId, file)
}

const dragOverIdx = ref<number | null>(null)
const dragFromIdx = ref(-1)
function onDragStart(idx: number, e: DragEvent) { dragFromIdx.value = idx; e.dataTransfer!.effectAllowed = 'move' }
function onDragOver(idx: number) { dragOverIdx.value = idx }
function onDrop(toIdx: number) {
  dragOverIdx.value = null
  if (dragFromIdx.value >= 0 && dragFromIdx.value !== toIdx) emit('reorderLayer', dragFromIdx.value, toIdx)
  dragFromIdx.value = -1
}
function onDragEnd() { dragOverIdx.value = null; dragFromIdx.value = -1 }

function onClickOutside(e: MouseEvent) {
  if (addDropdownRef.value && !addDropdownRef.value.contains(e.target as Node)) showAddDropdown.value = false
}
onMounted(() => document.addEventListener('click', onClickOutside))
onUnmounted(() => document.removeEventListener('click', onClickOutside))
</script>

<style lang="scss" scoped>
.sidebar-sections {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--md-sys-color-on-surface);
}

.presets {
  display: flex;
  gap: 6px;
}

.preset-btn {
  flex: 1;
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: 8px;
  background: var(--md-sys-color-surface-container-high);
  color: var(--md-sys-color-on-surface-variant);
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s;

  &.active {
    background: var(--md-sys-color-primary);
    color: var(--md-sys-color-on-primary);
    border-color: var(--md-sys-color-primary);
  }
}

.size-inputs {
  display: flex;
  align-items: center;
  gap: 8px;
}

.size-input {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: 8px;
  background: var(--md-sys-color-surface-container-high);
}

.size-label {
  font-size: 12px;
  color: var(--md-sys-color-on-surface-variant);
}

.size-field {
  width: 100%;
  border: none;
  background: transparent;
  color: var(--md-sys-color-on-surface);
  font-family: inherit;
  font-size: 14px;
  outline: none;
  font-variant-numeric: tabular-nums;
}

.size-sep {
  font-size: 12px;
  color: var(--md-sys-color-on-surface-variant);
  flex-shrink: 0;
}

.layers-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.add-wrap { position: relative; }

.add-btn {
  display: flex;
  align-items: center;
  gap: 2px;
  border: none;
  background: transparent;
  color: var(--md-sys-color-primary);
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  padding: 2px 4px;
  &:hover { filter: brightness(1.1); }
}

.add-menu {
  position: absolute;
  right: 0;
  top: 100%;
  margin-top: 4px;
  width: 144px;
  background: var(--md-sys-color-surface-container-high);
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: 8px;
  box-shadow: 0 10px 15px -3px rgba(0,0,0,0.3);
  padding: 4px;
  z-index: 30;
}

.add-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 12px;
  border: none;
  background: transparent;
  color: var(--md-sys-color-on-surface);
  font-family: inherit;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
  border-radius: 6px;
  &:hover { background: color-mix(in srgb, var(--md-sys-color-primary) 10%, transparent); }
}

.hidden-input { display: none; }

.empty-layers {
  font-size: 12px;
  color: var(--md-sys-color-on-surface-variant);
  padding: 12px 0;
  text-align: center;
}

.layer-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.layer-item-wrap { position: relative; }

.drop-indicator {
  position: absolute;
  top: -3px;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--md-sys-color-primary);
  border-radius: 1px;
  z-index: 10;
}

.layer-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: 8px;
  background: var(--md-sys-color-surface-container-high);
  cursor: pointer;
  font-size: 12px;
  transition: all 0.15s;

  &.selected {
    border-color: color-mix(in srgb, var(--md-sys-color-primary) 40%, transparent);
    background: color-mix(in srgb, var(--md-sys-color-primary) 10%, transparent);
  }
  &:hover { border-color: var(--md-sys-color-outline); }
}

.grip {
  font-size: 12px;
  color: var(--md-sys-color-on-surface-variant);
  flex-shrink: 0;
  cursor: move;
}

.color-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1px solid #fff;
  flex-shrink: 0;
  cursor: pointer;
}

.sticker-dot {
  width: 14px;
  height: 14px;
  border-radius: 4px;
  border: 1px solid var(--md-sys-color-outline-variant);
  flex-shrink: 0;
}

.layer-text-input {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  color: var(--md-sys-color-on-surface);
  font-family: inherit;
  font-size: 13px;
  outline: none;
  padding: 0;
}

.layer-name {
  flex: 1;
  min-width: 0;
  color: var(--md-sys-color-on-surface-variant);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &.line-through { text-decoration: line-through; }
}

.layer-type-icon {
  font-size: 14px;
  color: var(--md-sys-color-on-surface-variant);
  flex-shrink: 0;
}

.icon-action {
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--md-sys-color-on-surface-variant);
  cursor: pointer;
  padding: 2px;
  border-radius: 4px;
  font-size: 14px;
  flex-shrink: 0;
  transition: color 0.15s, background 0.15s;

  &:hover {
    color: var(--md-sys-color-primary);
    background: color-mix(in srgb, var(--md-sys-color-primary) 10%, transparent);
  }
  &.danger:hover {
    color: var(--md-sys-color-error);
    background: color-mix(in srgb, var(--md-sys-color-error) 10%, transparent);
  }
  &.cursor-pointer { cursor: pointer; }
}

.dropdown-enter-active, .dropdown-leave-active {
  transition: opacity 0.1s, transform 0.1s;
}
.dropdown-enter-from, .dropdown-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
