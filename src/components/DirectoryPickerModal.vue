<template>
  <v-modal @close="cancel">
    <template #headline>
      {{ title || $t('select_folder') }}
    </template>

    <template #content>
      <div class="picker">
        <p v-if="description" class="picker-desc">{{ description }}</p>
        <div class="hint">
          <span class="picker-current__label">{{ $t('current_path') }}:</span>
          <span class="mono picker-current__value">{{ currentDir || '-' }}</span>
        </div>
        <DirectoryBrowser
          :volumes="volumes"
          :loading-mounts="loadingMounts"
          :active-root="rootPath"
          :current-dir="currentDir"
          :can-go-up="canGoUp"
          :listing="listing"
          :dir-items="dirItems"
          :dir-name="dirName"
          :browser-min-height-px="320"
          :list-min-height-px="220"
          @select-root="selectRoot"
          @go-up="goUp"
          @enter-dir="enterDir"
        >
          <template #toolbar-actions>
            <v-icon-button v-tooltip="$t('ok')" @click.stop="chooseCurrent">
              <i-material-symbols:check-rounded />
            </v-icon-button>
          </template>
        </DirectoryBrowser>
      </div>
    </template>

    <template #actions>
      <v-outlined-button value="cancel" @click="cancel">{{ $t('cancel') }}</v-outlined-button>
      <v-filled-button value="ok" @click="chooseCurrent">{{ $t('ok') }}</v-filled-button>
    </template>
  </v-modal>
</template>

<script setup lang="ts">
import { Modal, popModal } from '@/components/modal'
import DirectoryBrowser from '@/components/DirectoryBrowser.vue'
import { useDirectoryPicker } from '@/hooks/directory-picker'

const props = defineProps({
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  initialPath: { type: String, default: '' },
})

const emit = defineEmits<{
  (e: typeof Modal.EVENT_PROMPT, path: string): void
}>()

const { volumes, loadingMounts, rootPath, currentDir, canGoUp, listing, dirItems, selectRoot, enterDir, goUp, dirName } = useDirectoryPicker(props.initialPath)

function chooseCurrent() { emit(Modal.EVENT_PROMPT, currentDir.value) }
function cancel() { popModal() }
</script>

<style scoped>
.picker {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: min(960px, 90vw);
}

.picker-desc {
  margin: 0;
  color: var(--md-sys-color-on-surface-variant);
}

.picker-current__label {
  color: var(--md-sys-color-on-surface-variant);
  margin-inline-end: 4px;
}

.picker-current__value {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}
</style>
