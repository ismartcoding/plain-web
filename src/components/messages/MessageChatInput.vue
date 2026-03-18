<template>
  <div class="chat-input-bar">
    <div v-if="pendingFiles.length" class="chat-attachment-preview">
      <div v-for="(file, idx) in pendingFiles" :key="idx" class="chat-attachment-preview-item">
        <img v-if="file.type.startsWith('image/')" :src="filePreviewUrl(file)" class="chat-preview-thumb" />
        <div v-else class="chat-preview-file">
          <i-material-symbols:attach-file-rounded />
        </div>
        <span class="chat-preview-name">{{ file.name }}</span>
        <span class="chat-preview-size" :class="{ warn: !file.type.startsWith('image/') && file.size > warnSize }">{{ formatFileSize(file.size) }}</span>
        <v-icon-button class="chat-preview-remove" @click="$emit('removeFile', idx)">
          <i-material-symbols:close-rounded />
        </v-icon-button>
      </div>
      <div v-if="hasLargeNonImageFile" class="chat-size-warning">
        <i-material-symbols:warning-outline-rounded />
        {{ $t('mms_large_file_warning') }}
      </div>
      <div v-else-if="totalPendingSize > warnSize" class="chat-size-hint">
        {{ $t('mms_image_auto_compress') }}
      </div>
    </div>
    <div class="chat-input-row">
      <input ref="fileInputRef" type="file" multiple accept="image/*,video/*,audio/*" class="hidden-file-input" @change="$emit('fileSelected', $event)" />
      <v-text-field
        :model-value="modelValue"
        type="textarea"
        :rows="1"
        :placeholder="$t('write_a_message')"
        class="chat-input-field"
        @update:model-value="$emit('update:modelValue', $event)"
        @keydown.enter.exact.prevent="$emit('send')"
      >
        <template #leading-icon>
          <v-icon-button v-tooltip="$t('attachments')" @click="$emit('openFilePicker')">
            <i-material-symbols:attach-file-rounded />
          </v-icon-button>
        </template>
        <template #trailing-icon>
          <v-icon-button class="btn-send" :disabled="sendDisabled" @click="$emit('send')">
            <i-material-symbols:send-rounded />
          </v-icon-button>
        </template>
      </v-text-field>
    </div>
  </div>
</template>

<script setup lang="ts">
import { formatFileSize } from '@/lib/format'

defineProps<{
  modelValue: string
  pendingFiles: File[]
  totalPendingSize: number
  hasLargeNonImageFile: boolean
  warnSize: number
  sendDisabled: boolean
}>()

defineEmits<{
  'update:modelValue': [value: string]
  send: []
  openFilePicker: []
  fileSelected: [event: Event]
  removeFile: [index: number]
}>()

const fileInputRef = defineModel<HTMLInputElement | undefined>('fileInputRef')

function filePreviewUrl(file: File): string {
  return URL.createObjectURL(file)
}
</script>

<style scoped lang="scss">
.chat-input-bar { display: flex; flex-direction: column; padding: 8px 16px 12px; border-top: 1px solid var(--md-sys-color-outline-variant); }
.chat-input-row {
  display: flex; align-items: flex-end;
  .hidden-file-input { display: none; }
  .chat-input-field { flex: 1; }
  .btn-send { margin-block-start: 4px; }
}
.chat-attachment-preview { display: flex; flex-wrap: wrap; gap: 8px; padding-bottom: 8px; }
.chat-attachment-preview-item {
  display: flex; align-items: center; gap: 6px;
  background: var(--md-sys-color-surface-container-high); border-radius: 8px; padding: 4px 8px; max-width: 200px;
}
.chat-preview-thumb { width: 32px; height: 32px; object-fit: cover; border-radius: 4px; flex-shrink: 0; }
.chat-preview-file {
  width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
  border-radius: 4px; flex-shrink: 0; color: var(--md-sys-color-on-surface-variant);
}
.chat-preview-name { font-size: 0.75rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0; }
.chat-preview-remove { flex-shrink: 0; }
.chat-preview-size { font-size: 0.6875rem; color: var(--md-sys-color-on-surface-variant); flex-shrink: 0; &.warn { color: var(--md-sys-color-error); font-weight: 500; } }
.chat-size-warning { display: flex; align-items: center; gap: 4px; font-size: 0.75rem; color: var(--md-sys-color-error); padding: 4px 0; }
.chat-size-hint { font-size: 0.75rem; color: var(--md-sys-color-on-surface-variant); padding: 4px 0; width: 100%; }
</style>
