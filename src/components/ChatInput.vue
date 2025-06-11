<!-- eslint-disable vue/no-v-html -->
<template>
  <div class="chat-input">
    <div class="textarea-wrapper">
      <div v-show="displayDragMask" class="drag-mask">{{ $t('release_to_send_files') }}</div>
      <v-text-field
        :model-value="modelValue"
        type="textarea"
        :rows="2"
        autocomplete="off"
        class="textarea"
        :placeholder="$t('chat_input_hint')"
        @update:model-value="$emit('update:modelValue', $event)"
        @paste="pasteFiles"
        @drop.prevent="dropFiles"
        @dragenter.prevent="fileDragEnter"
        @dragleave.prevent="fileDragLeave"
        @keydown.enter.exact.prevent="handleSend"
        @keydown.enter.shift.exact.prevent="$emit('update:modelValue', modelValue + '\n')"
        @keydown.enter.ctrl.exact.prevent="$emit('update:modelValue', modelValue + '\n')"
        @keydown.enter.alt.exact.prevent="$emit('update:modelValue', modelValue + '\n')"
        @keydown.enter.meta.exact.prevent="$emit('update:modelValue', modelValue + '\n')"
      >
        <template #leading-icon>
          <div class="leading-icons">
            <button class="btn-icon" @click="sendImages">
              <i-material-symbols:image-outline-rounded />
            </button>
            <button class="btn-icon" @click="sendFiles">
              <i-material-symbols:folder-outline-rounded />
            </button>
          </div>
        </template>
        <template #trailing-icon>
          <button class="btn-icon btn-send" :disable="createLoading" @click="handleSend">
            <i-material-symbols:send-outline-rounded />
          </button>
        </template>
      </v-text-field>
    </div>
    <input ref="fileInput" style="display: none" type="file" multiple @change="uploadFilesChanged" />
    <input ref="imageInput" style="display: none" type="file" accept="image/*, video/*" multiple @change="uploadImagesChanged" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

interface Props {
  modelValue: string
  createLoading: boolean
}

interface Emits {
  (e: 'update:modelValue', value: string): void
  (e: 'send-message', message: string): void
  (e: 'send-files', files: File[]): void
  (e: 'send-images', files: File[]): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

const { t } = useI18n()
const fileInput = ref<HTMLInputElement>()
const imageInput = ref<HTMLInputElement>()
const displayDragMask = ref(false)

function handleSend() {
  emit('send-message', '')
}

function uploadFilesChanged(e: Event) {
  const files = (e.target as HTMLInputElement).files as FileList
  const items: File[] = []
  for (const item of files) {
    items.push(item)
  }
  emit('send-files', items)
}

function uploadImagesChanged(e: Event) {
  const files = (e.target as HTMLInputElement).files as FileList
  const items: File[] = []
  for (const item of files) {
    items.push(item)
  }
  emit('send-images', items)
}

function sendImages() {
  imageInput.value!.value = ''
  imageInput.value!.click()
}

function sendFiles() {
  fileInput.value!.value = ''
  fileInput.value!.click()
}

function fileDragEnter() {
  displayDragMask.value = true
}

function fileDragLeave() {
  displayDragMask.value = false
}

function dropFiles(e: DragEvent) {
  const fileList = e.dataTransfer?.files as FileList
  displayDragMask.value = false
  if (fileList) {
    const files: File[] = []
    for (const item of fileList) {
      files.push(item)
    }
    if (files.length) {
      emit('send-files', files)
    }
  }
}

function pasteFiles(e: ClipboardEvent) {
  const items = e.clipboardData?.items as DataTransferItemList
  if (items) {
    const images: File[] = []
    const files: File[] = []
    for (const item of items) {
      if (item.kind !== 'file') {
        continue
      }
      const file = item.getAsFile()!
      if (file.type.startsWith('image') || file.type.startsWith('video')) {
        images.push(file)
      } else {
        files.push(file)
      }
    }
    if (images.length) {
      e.preventDefault()
      emit('send-images', images)
    }
    if (files.length) {
      e.preventDefault()
      emit('send-files', files)
    }
  }
}
</script>

<style lang="scss" scoped>
.chat-input {
  background-color: var(--md-sys-color-surface);
  padding: 8px 16px;
  --outlined-field-bg: var(--md-sys-color-surface);

  .leading-icons {
    display: flex;
    flex-direction: column;
    margin-block-start: 4px;
  }

  .btn-send {
    margin-block-start: 4px;
  }

  .textarea-wrapper {
    position: relative;
    .textarea {
      display: block;
    }
  }
}

.drag-mask {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  z-index: 10;
  pointer-events: none;
}
</style> 