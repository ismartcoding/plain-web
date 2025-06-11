<template>
  <v-dropdown v-if="hasKeyboard" v-model="shortcutsMenuVisible">
    <template #trigger>
      <slot name="trigger">
        <v-icon-button v-tooltip="$t('keyboard_shortcuts')">
          <template #icon>
            <i-lucide:keyboard />
          </template>
        </v-icon-button>
      </slot>
    </template>
    <div class="shortcuts-menu">
      <div class="shortcuts-title">{{ $t('keyboard_shortcuts') }}</div>
      <div class="shortcuts-list">
        <div 
          v-for="shortcut in shortcuts" 
          :key="shortcut.keys.join('+')" 
          class="shortcut-item"
        >
          <span class="shortcut-keys">
            <kbd 
              v-for="key in shortcut.keys" 
              :key="key"
              :class="{ 'no-style': key === '+' }"
            >
              {{ key === 'modifier' ? modifierKey : key }}
            </kbd>
          </span>
          <span class="shortcut-desc">{{ $t(shortcut.description) }}</span>
        </div>
      </div>
    </div>
  </v-dropdown>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

interface ShortcutItem {
  keys: string[]
  description: string
}

defineProps<{
  shortcuts: ShortcutItem[]
}>()

const shortcutsMenuVisible = ref(false)
const hasKeyboard = ref(false)

const isMac = computed(() => {
  return /Mac|iPhone|iPad|iPod/.test(navigator.userAgent)
})

const modifierKey = computed(() => {
  return isMac.value ? 'Cmd' : 'Ctrl'
})

function detectKeyboard() {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
  const isLargeScreen = window.innerWidth >= 768
  
  hasKeyboard.value = !isMobile || (isLargeScreen && !hasTouch) || (!hasTouch && isLargeScreen)
  
  if (!hasKeyboard.value && isLargeScreen) {
    hasKeyboard.value = true
  }
}

onMounted(() => {
  detectKeyboard()
  window.addEventListener('resize', detectKeyboard)
})

onUnmounted(() => {
  window.removeEventListener('resize', detectKeyboard)
})
</script>

<style lang="scss" scoped>
.shortcuts-menu {
  min-width: 280px;
  padding: 16px;
  background: var(--md-sys-color-surface-container);
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.shortcuts-title {
  font-size: 1rem;
  font-weight:500;
  color: var(--md-sys-color-on-surface);
  margin-bottom: 12px;
  padding-bottom: 8px;
}

.shortcuts-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.shortcut-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 4px 0;
}

.shortcut-keys {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.shortcut-keys kbd {
  display: inline-block;
  padding: 2px 6px;
  font-size: 0.75rem;
  font-family: monospace;
  background: var(--md-sys-color-surface-variant);
  color: var(--md-sys-color-on-surface-variant);
  border: 1px solid var(--md-sys-color-outline);
  border-radius: 4px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  min-width: 20px;
  text-align: center;

  &.no-style {
    background: none;
    border: none;
    box-shadow: none;
    padding: 0;
  }
}

.shortcut-desc {
  font-size: 0.875rem;
  color: var(--md-sys-color-on-surface);
  text-align: right;
  flex: 1;
}
</style> 