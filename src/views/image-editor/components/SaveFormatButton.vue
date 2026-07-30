<template>
  <div ref="rootRef" class="save-format">
    <button class="save-btn" :class="buttonClass" :disabled="disabled" @click="toggle">
      <i-lucide-download />
      <span>{{ $t('image_editor.export_image') }}</span>
    </button>

    <Transition name="dropdown">
      <div v-if="open" class="menu">
        <p class="menu-title">{{ $t('image_editor.export_format') }}</p>
        <button
          v-for="f in formats"
          :key="f.id"
          class="menu-item"
          @click="pick(f.id)"
        >
          <span class="fmt-label">{{ f.label }}</span>
          <span class="fmt-hint">{{ f.hint }}</span>
        </button>
        <div class="menu-divider" />
        <button class="menu-item" @click="copyClipboard">
          <i-lucide-clipboard class="copy-icon" />
          <span class="fmt-label">{{ copied ? $t('image_editor.copied_to_clipboard') : $t('image_editor.copy_to_clipboard') }}</span>
        </button>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'

export type SaveFormat = 'png' | 'jpeg' | 'webp'

const props = withDefaults(defineProps<{
  buttonClass?: string
  disabled?: boolean
}>(), {
  buttonClass: '',
  disabled: false,
})

const emit = defineEmits<{
  save: [format: SaveFormat]
  copy: []
}>()

const { t } = useI18n()
const open = ref(false)
const copied = ref(false)
const rootRef = ref<HTMLElement | null>(null)

const formats = computed(() => [
  { id: 'png' as SaveFormat, label: 'PNG', hint: t('image_editor.format_hint_png') },
  { id: 'jpeg' as SaveFormat, label: 'JPEG', hint: t('image_editor.format_hint_jpeg') },
  { id: 'webp' as SaveFormat, label: 'WebP', hint: t('image_editor.format_hint_webp') },
])

function toggle() { open.value = !open.value }

function pick(format: SaveFormat) {
  open.value = false
  emit('save', format)
}

function copyClipboard() {
  copied.value = true
  emit('copy')
  setTimeout(() => { copied.value = false; open.value = false }, 800)
}

function onClickOutside(e: MouseEvent) {
  if (rootRef.value && !rootRef.value.contains(e.target as Node)) open.value = false
}

onMounted(() => document.addEventListener('pointerdown', onClickOutside))
onUnmounted(() => document.removeEventListener('pointerdown', onClickOutside))
</script>

<style lang="scss" scoped>
.save-format { position: relative; }

.save-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 12px 16px;
  border: none;
  border-radius: 20px;
  background: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  font-family: inherit;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: box-shadow 0.2s, opacity 0.2s;

  &:hover:not(:disabled) { box-shadow: 0 1px 3px rgba(0,0,0,0.3); }
  &:disabled { opacity: 0.5; cursor: default; }
}

.menu {
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  margin-bottom: 8px;
  background: var(--md-sys-color-surface-container-high);
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: 12px;
  box-shadow: 0 10px 15px -3px rgba(0,0,0,0.3);
  padding: 6px;
  z-index: 50;
  min-width: 180px;
}

.menu-title {
  padding: 4px 12px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--md-sys-color-on-surface-variant);
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: var(--md-sys-color-on-surface);
  font-family: inherit;
  font-size: 14px;
  text-align: left;
  cursor: pointer;
  border-radius: 8px;
  transition: background 0.15s;

  &:hover { background: color-mix(in srgb, var(--md-sys-color-primary) 10%, transparent); }
}

.fmt-label { font-weight: 500; }
.fmt-hint { margin-left: auto; font-size: 11px; color: var(--md-sys-color-on-surface-variant); }

.copy-icon { color: var(--md-sys-color-on-surface-variant); }

.menu-divider {
  height: 1px;
  margin: 4px 12px;
  background: var(--md-sys-color-outline-variant);
}

.dropdown-enter-active, .dropdown-leave-active {
  transition: opacity 0.1s, transform 0.1s;
}
.dropdown-enter-from, .dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.95);
}
</style>
