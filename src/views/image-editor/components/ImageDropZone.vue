<template>
  <div
    class="drop-zone"
    :class="{ compact, dragging }"
    @dragover.prevent="dragging = true"
    @dragleave.prevent="dragging = false"
    @drop.prevent="handleDrop"
    @click="fileInput?.click()"
  >
    <input
      ref="fileInput"
      type="file"
      :accept="accept"
      :multiple="multiple"
      class="hidden-input"
      @change="handleFileChange"
    />

    <div class="content">
      <div class="icon-circle" :class="compact ? 'sm' : 'lg'">
        <i-lucide-image v-if="icon === 'image'" />
        <i-lucide-plus v-else />
      </div>
      <div>
        <p class="title">
          {{ $t('image_editor.drag_drop') }}
          <span class="browse">{{ $t('image_editor.browse') }}</span>
        </p>
        <p class="hint">
          {{ $t('image_editor.supported_formats_value', { formats, size: maxSize }) }}
        </p>
        <p v-if="paste" class="paste-hint">{{ $t('image_editor.paste_shortcut') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const props = withDefaults(defineProps<{
  accept: string
  formats: string
  maxSize?: number
  multiple?: boolean
  compact?: boolean
  paste?: boolean
  icon?: 'plus' | 'image'
}>(), {
  maxSize: 20,
  multiple: false,
  compact: false,
  paste: true,
  icon: 'plus',
})

const emit = defineEmits<{
  select: [files: File[]]
}>()

const fileInput = ref<HTMLInputElement | null>(null)
const dragging = ref(false)

function handleFileChange(e: Event) {
  const files = (e.target as HTMLInputElement).files
  if (files?.length) emit('select', Array.from(files))
  if (fileInput.value) fileInput.value.value = ''
}

function handleDrop(e: DragEvent) {
  dragging.value = false
  const files = e.dataTransfer?.files
  if (files?.length) emit('select', Array.from(files))
}

function handlePaste(e: ClipboardEvent) {
  if (!props.paste) return
  const items = e.clipboardData?.items
  if (!items) return
  const imageFiles: File[] = []
  for (const item of Array.from(items)) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (file) imageFiles.push(file)
      if (!props.multiple) break
    }
  }
  if (imageFiles.length) emit('select', imageFiles)
}

onMounted(() => document.addEventListener('paste', handlePaste))
onUnmounted(() => document.removeEventListener('paste', handlePaste))
</script>

<style lang="scss" scoped>
.drop-zone {
  position: relative;
  border: 2px dashed var(--md-sys-color-outline);
  border-radius: 16px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.2s, background-color 0.2s;
  padding: 48px;

  &.compact { padding: 24px; }
  &.dragging {
    border-color: var(--md-sys-color-primary);
    background-color: color-mix(in srgb, var(--md-sys-color-primary) 10%, transparent);
  }
  &:hover {
    border-color: var(--md-sys-color-primary);
    background-color: color-mix(in srgb, var(--md-sys-color-primary) 5%, transparent);
  }
}

.hidden-input { display: none; }

.content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  pointer-events: none;
}

.icon-circle {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--md-sys-color-surface-container-high);
  color: var(--md-sys-color-on-surface-variant);
  border-radius: 16px;

  &.lg { width: 64px; height: 64px; font-size: 32px; }
  &.sm { width: 40px; height: 40px; font-size: 20px; border-radius: 12px; }
}

.title {
  font-size: 16px;
  font-weight: 500;
  color: var(--md-sys-color-on-surface);
  margin: 0;
}

.browse {
  color: var(--md-sys-color-primary);
  text-decoration: underline;
}

.hint {
  margin-top: 4px;
  font-size: 13px;
  color: var(--md-sys-color-on-surface-variant);
}

.paste-hint {
  margin-top: 6px;
  font-size: 12px;
  color: var(--md-sys-color-on-surface-variant);
}
</style>
