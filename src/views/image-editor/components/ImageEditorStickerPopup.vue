<template>
  <Teleport to="body">
    <Transition name="popup">
      <div
        v-if="layer"
        ref="panelRef"
        class="panel"
        :style="{ top: posY + 'px', left: posX + 'px' }"
      >
        <div class="header" @pointerdown.prevent="onDragStart">
          <span class="title">{{ $t('image_editor.tool_sticker') }}</span>
          <button class="close-btn" @click="$emit('close')">
            <i-lucide-x />
          </button>
        </div>

        <div class="row">
          <span class="label">Aa</span>
          <input :value="layer.fontSize" type="range" min="10" max="120" class="slider" @input="onFontSize" />
          <span class="value">{{ layer.fontSize }}</span>
        </div>

        <div class="toggles">
          <button
            class="toggle-btn bold"
            :class="{ active: layer.fontWeight === 'bold' }"
            @click="toggleBold"
          >B</button>
          <button
            class="toggle-btn italic"
            :class="{ active: layer.fontStyle === 'italic' }"
            @click="toggleItalic"
          >I</button>
          <div class="divider" />
          <button
            v-for="c in COLORS"
            :key="c"
            class="swatch"
            :class="{ active: layer.color === c }"
            :style="{ backgroundColor: c }"
            @click="onColor(c)"
          />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onUnmounted } from 'vue'
import type { StickerLayer } from '@/views/image-editor/utils/types'
import { measureStickerSize } from '@/views/image-editor/utils/editor-draw-layers'
import type { ImageEditorDoc } from '@/views/image-editor/composables/useImageEditorDoc'

const COLORS = ['#fef08a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#fde68a']

const props = defineProps<{
  layer: StickerLayer | null
  rect: { top: number; left: number }
  doc: ImageEditorDoc
}>()

const emit = defineEmits<{ close: [] }>()

const panelRef = ref<HTMLElement | null>(null)

function resizeFor(layer: StickerLayer) {
  const { w, h } = measureStickerSize(layer)
  props.doc.setLayerProps(layer.id, { w, h })
}

function onFontSize(e: Event) {
  if (!props.layer) return
  const size = Number((e.target as HTMLInputElement).value)
  const updated = { ...props.layer, fontSize: size }
  props.doc.setLayerProps(props.layer.id, { fontSize: size })
  resizeFor(updated)
}

function onColor(c: string) {
  if (!props.layer) return
  const updated = { ...props.layer, color: c }
  props.doc.setLayerProps(props.layer.id, { color: c })
  resizeFor(updated)
}

function toggleBold() {
  if (!props.layer) return
  const next = props.layer.fontWeight === 'bold' ? '600' : 'bold'
  const updated = { ...props.layer, fontWeight: next }
  props.doc.setLayerProp(props.layer.id, 'fontWeight', next)
  resizeFor(updated)
}

function toggleItalic() {
  if (!props.layer) return
  const next = props.layer.fontStyle === 'italic' ? 'normal' : 'italic'
  props.doc.setLayerProp(props.layer.id, 'fontStyle', next)
}

function onClickOutside(e: MouseEvent) {
  if (!props.layer || !panelRef.value) return
  if (panelRef.value.contains(e.target as Node)) return
  emit('close')
}

watch(() => props.layer, (layer) => {
  if (layer) {
    dragOffset.x = 0
    dragOffset.y = 0
    setTimeout(() => document.addEventListener('pointerdown', onClickOutside), 0)
  } else {
    document.removeEventListener('pointerdown', onClickOutside)
  }
})

onUnmounted(() => document.removeEventListener('pointerdown', onClickOutside))

const dragOffset = reactive({ x: 0, y: 0 })
let _dragStartMx = 0
let _dragStartMy = 0
let _dragStartOx = 0
let _dragStartOy = 0

const posX = computed(() => props.rect.left + dragOffset.x)
const posY = computed(() => props.rect.top + dragOffset.y)

function onDragStart(e: PointerEvent) {
  _dragStartMx = e.clientX
  _dragStartMy = e.clientY
  _dragStartOx = dragOffset.x
  _dragStartOy = dragOffset.y
  document.addEventListener('pointermove', onDragMove)
  document.addEventListener('pointerup', onDragEnd)
}
function onDragMove(e: PointerEvent) {
  dragOffset.x = _dragStartOx + e.clientX - _dragStartMx
  dragOffset.y = _dragStartOy + e.clientY - _dragStartMy
}
function onDragEnd() {
  document.removeEventListener('pointermove', onDragMove)
  document.removeEventListener('pointerup', onDragEnd)
}
</script>

<style lang="scss" scoped>
.panel {
  position: fixed;
  z-index: 102;
  width: 256px;
  max-width: 100%;
  background: var(--md-sys-color-surface-container-high);
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: 12px;
  box-shadow: 0 20px 25px -5px rgba(0,0,0,0.3);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: move;
  user-select: none;
}

.title {
  font-size: 12px;
  font-weight: 600;
  color: var(--md-sys-color-on-surface);
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--md-sys-color-on-surface-variant);
  cursor: pointer;
  padding: 2px;
  border-radius: 4px;
  font-size: 16px;
  &:hover { color: var(--md-sys-color-on-surface); }
}

.row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.label {
  font-size: 10px;
  text-transform: uppercase;
  font-weight: 600;
  color: var(--md-sys-color-on-surface-variant);
  flex-shrink: 0;
}

.slider {
  flex: 1;
  accent-color: var(--md-sys-color-primary);
}

.value {
  font-size: 10px;
  color: var(--md-sys-color-on-surface-variant);
  width: 24px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.toggles {
  display: flex;
  align-items: center;
  gap: 4px;
}

.toggle-btn {
  padding: 6px 10px;
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: 8px;
  background: var(--md-sys-color-surface);
  color: var(--md-sys-color-on-surface-variant);
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;

  &.bold { font-weight: 700; }
  &.italic { font-style: italic; }

  &.active {
    background: color-mix(in srgb, var(--md-sys-color-primary) 20%, transparent);
    border-color: color-mix(in srgb, var(--md-sys-color-primary) 40%, transparent);
    color: var(--md-sys-color-primary);
  }
}

.divider {
  width: 1px;
  height: 20px;
  background: var(--md-sys-color-outline-variant);
  margin: 0 4px;
}

.swatch {
  width: 24px;
  height: 24px;
  border: 2px solid var(--md-sys-color-outline-variant);
  border-radius: 6px;
  cursor: pointer;
  flex-shrink: 0;
  transition: transform 0.1s, border-color 0.1s;
  &.active {
    border-color: var(--md-sys-color-primary);
    transform: scale(1.1);
  }
}

.popup-enter-active, .popup-leave-active {
  transition: opacity 0.15s, transform 0.15s;
  transform-origin: top right;
}
.popup-enter-from, .popup-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
