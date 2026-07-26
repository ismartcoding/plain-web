<template>
  <div class="toolbar">
    <div class="tool-group">
      <div
        v-for="tool in TOOL_LIST"
        :key="tool.id"
        class="tool-wrap"
      >
        <button
          :title="$t(tool.labelKey)"
          :disabled="isCropping && tool.id !== 'crop'"
          class="tool-btn"
          :class="{
            active: activeTool === tool.id,
            disabled: isCropping && tool.id !== 'crop',
          }"
          @click="$emit('update:activeTool', tool.id)"
        >
          <component :is="tool.icon" />
        </button>
        <div class="tooltip">{{ $t(tool.labelKey) }}</div>
      </div>
    </div>

    <div class="separator" />

    <div class="tool-wrap">
      <label
        class="tool-btn"
        :class="{ disabled: isCropping }"
        :title="$t('image_editor.add_image')"
      >
        <i-lucide-image />
        <input v-if="!isCropping" type="file" accept="image/*" class="hidden-input" @change="onImageFileChange" />
      </label>
      <div class="tooltip">{{ $t('image_editor.add_image') }}</div>
    </div>

    <div class="separator" />

    <div class="color-section" :class="{ disabled: isCropping }">
      <input
        :value="activeColor"
        type="color"
        class="color-input"
        @input="$emit('update:activeColor', ($event.target as HTMLInputElement).value)"
      />
      <div class="quick-colors">
        <button
          v-for="c in quickColors"
          :key="c"
          class="quick-color"
          :class="{ active: activeColor === c }"
          :style="{ backgroundColor: c }"
          @click="$emit('update:activeColor', c)"
        />
      </div>
    </div>

    <div class="separator" />

    <div class="width-section" :class="{ disabled: isCropping }">
      <div
        v-for="lw in lineWidths"
        :key="lw"
        class="tool-wrap"
      >
        <button
          class="width-btn"
          :class="{ active: activeLineWidth === lw }"
          @click="$emit('update:activeLineWidth', lw)"
        >
          <div class="width-dot" :style="{ width: Math.min(lw, 24) + 'px', height: Math.min(lw, 24) + 'px' }" />
        </button>
        <div class="tooltip">{{ lw }}px</div>
      </div>
    </div>

    <div class="spacer" />

    <div class="actions">
      <div class="tool-wrap">
        <button
          :disabled="!canUndo || isCropping"
          class="action-btn"
          :class="{ 'no-action': !canUndo || isCropping }"
          @click="$emit('undo')"
        >
          <i-lucide-undo-2 />
        </button>
        <div class="tooltip">{{ $t('image_editor.undo') }}</div>
      </div>
      <div class="tool-wrap">
        <button
          :disabled="!canRedo || isCropping"
          class="action-btn"
          :class="{ 'no-action': !canRedo || isCropping }"
          @click="$emit('redo')"
        >
          <i-lucide-redo-2 />
        </button>
        <div class="tooltip">{{ $t('image_editor.redo') }}</div>
      </div>
      <div class="tool-wrap">
        <button
          :disabled="isCropping"
          class="action-btn"
          :class="{ 'no-action': isCropping }"
          @click="$emit('clearAll')"
        >
          <i-lucide-trash-2 />
        </button>
        <div class="tooltip">{{ $t('image_editor.clear_all') }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import MousePointer2 from '~icons/lucide/mouse-pointer-2'
import Crop from '~icons/lucide/crop'
import Paintbrush from '~icons/lucide/paintbrush'
import MoveUpRight from '~icons/lucide/move-up-right'
import Square from '~icons/lucide/square'
import Circle from '~icons/lucide/circle'
import Highlighter from '~icons/lucide/highlighter'
import Grid3x3 from '~icons/lucide/grid-3x3'
import Type from '~icons/lucide/type'
import StickyNote from '~icons/lucide/sticky-note'
import type { EditorTool } from '@/views/image-editor/utils/types'
import { TOOL_COLORS, LINE_WIDTHS } from '@/views/image-editor/utils/types'

defineProps<{
  activeTool: EditorTool
  activeColor: string
  activeLineWidth: number
  canUndo: boolean
  canRedo: boolean
  isCropping?: boolean
}>()

const emit = defineEmits<{
  'update:activeTool': [value: EditorTool]
  'update:activeColor': [value: string]
  'update:activeLineWidth': [value: number]
  undo: []
  redo: []
  clearAll: []
  addImageFile: [file: File]
}>()

const TOOL_LIST: { id: EditorTool; icon: any; labelKey: string }[] = [
  { id: 'select', icon: MousePointer2, labelKey: 'image_editor.tool_select' },
  { id: 'crop', icon: Crop, labelKey: 'image_editor.tool_crop' },
  { id: 'brush', icon: Paintbrush, labelKey: 'image_editor.tool_brush' },
  { id: 'arrow', icon: MoveUpRight, labelKey: 'image_editor.tool_arrow' },
  { id: 'rect', icon: Square, labelKey: 'image_editor.tool_rect' },
  { id: 'ellipse', icon: Circle, labelKey: 'image_editor.tool_ellipse' },
  { id: 'highlight', icon: Highlighter, labelKey: 'image_editor.tool_highlight' },
  { id: 'mosaic', icon: Grid3x3, labelKey: 'image_editor.tool_mosaic' },
  { id: 'text', icon: Type, labelKey: 'image_editor.tool_text' },
  { id: 'sticker', icon: StickyNote, labelKey: 'image_editor.tool_sticker' },
]

const quickColors = TOOL_COLORS.slice(0, 6)
const lineWidths = LINE_WIDTHS

function onImageFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  ;(e.target as HTMLInputElement).value = ''
  emit('addImageFile', file)
}
</script>

<style lang="scss" scoped>
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.tool-group {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px;
  background: var(--md-sys-color-surface-container-high);
  border-radius: 12px;
}

.tool-wrap {
  position: relative;

  &:hover .tooltip { opacity: 1; }
}

.tool-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--md-sys-color-on-surface-variant);
  cursor: pointer;
  font-size: 18px;
  transition: all 0.15s;

  &:hover:not(.disabled) {
    color: var(--md-sys-color-on-surface);
    background: color-mix(in srgb, var(--md-sys-color-on-surface) 10%, transparent);
  }
  &.active {
    background: color-mix(in srgb, var(--md-sys-color-primary) 20%, transparent);
    color: var(--md-sys-color-primary);
    font-weight: 600;
  }
  &.disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

.tooltip {
  position: absolute;
  left: 50%;
  top: 100%;
  transform: translateX(-50%);
  margin-top: 4px;
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 500;
  color: #fff;
  background: rgba(0, 0, 0, 0.85);
  border-radius: 6px;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s;
  z-index: 50;
}

.separator {
  width: 1px;
  height: 28px;
  background: var(--md-sys-color-outline-variant);
  margin: 0 4px;
}

.hidden-input { display: none; }

.color-section {
  display: flex;
  align-items: center;
  gap: 8px;

  &.disabled {
    opacity: 0.4;
    pointer-events: none;
  }
}

.color-input {
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: 8px;
  background: none;
  cursor: pointer;
}

.quick-colors {
  display: flex;
  align-items: center;
  gap: 4px;
}

.quick-color {
  width: 20px;
  height: 20px;
  border: 2px solid var(--md-sys-color-outline-variant);
  border-radius: 50%;
  cursor: pointer;
  padding: 0;
  transition: transform 0.1s, border-color 0.1s;

  &.active {
    border-color: var(--md-sys-color-primary);
    transform: scale(1.1);
  }
}

.width-section {
  display: flex;
  align-items: center;
  gap: 4px;

  &.disabled {
    opacity: 0.4;
    pointer-events: none;
  }
}

.width-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--md-sys-color-on-surface-variant);
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    background: color-mix(in srgb, var(--md-sys-color-on-surface) 5%, transparent);
  }
  &.active {
    background: color-mix(in srgb, var(--md-sys-color-primary) 20%, transparent);
    color: var(--md-sys-color-primary);
    border: 1px solid color-mix(in srgb, var(--md-sys-color-primary) 30%, transparent);
  }
}

.width-dot {
  border-radius: 50%;
  background: currentColor;
}

.spacer { flex: 1; }

.actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--md-sys-color-on-surface-variant);
  cursor: pointer;
  font-size: 16px;
  transition: all 0.15s;

  &:hover:not(.no-action):not(:disabled) {
    color: var(--md-sys-color-on-surface);
    background: color-mix(in srgb, var(--md-sys-color-on-surface) 10%, transparent);
  }
  &.no-action, &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}
</style>
