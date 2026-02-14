<template>
  <v-modal @close="close">
    <template #headline>
      {{ title || $t('keyboard_shortcuts') }}
    </template>

    <template #content>
      <div class="shortcuts">
        <div v-for="shortcut in shortcuts" :key="shortcut.keys.join('+')" class="shortcut-item">
          <span class="shortcut-keys">
            <kbd v-for="key in shortcut.keys" :key="key" :class="{ 'no-style': key === '+' }">
              {{ key === 'modifier' ? modifierKey : key }}
            </kbd>
          </span>
          <span class="shortcut-desc">{{ $t(shortcut.description) }}</span>
        </div>
      </div>
    </template>

    <template #actions>
      <v-filled-button @click="close">{{ $t('ok') }}</v-filled-button>
    </template>
  </v-modal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { popModal } from '@/components/modal'
import type { ShortcutItem } from '@/lib/shortcuts/media'

const { t: $t } = useI18n()

defineProps<{
  shortcuts: ShortcutItem[]
  title?: string
}>()

const isMac = computed(() => {
  return /Mac|iPhone|iPad|iPod/.test(navigator.userAgent)
})

const modifierKey = computed(() => {
  return isMac.value ? 'Cmd' : 'Ctrl'
})

function close() {
  popModal()
}
</script>

<style scoped lang="scss">
.shortcuts {
  min-width: 320px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-block: 8px;
}

.shortcut-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.shortcut-keys {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;

  kbd {
    display: inline-block;
    padding: 2px 6px;
    font-size: 0.75rem;
    font-family: monospace;
    background: var(--md-sys-color-surface-variant);
    color: var(--md-sys-color-on-surface-variant);
    border: 1px solid var(--md-sys-color-outline);
    border-radius: 4px;
    min-width: 20px;
    text-align: center;

    &.no-style {
      background: none;
      border: none;
      padding: 0;
    }
  }
}

.shortcut-desc {
  font-size: 0.875rem;
  color: var(--md-sys-color-on-surface);
  text-align: right;
  flex: 1;
}
</style>
