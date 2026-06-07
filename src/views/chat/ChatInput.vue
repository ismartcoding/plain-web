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
        @keydown.enter.exact="onEnterKey"
        @keydown.enter.shift.exact.prevent="$emit('update:modelValue', modelValue + '\n')"
        @keydown.enter.ctrl.exact.prevent="$emit('update:modelValue', modelValue + '\n')"
        @keydown.enter.alt.exact.prevent="$emit('update:modelValue', modelValue + '\n')"
        @keydown.enter.meta.exact.prevent="$emit('update:modelValue', modelValue + '\n')"
      >
        <template #leading-icon>
          <div class="leading-icons">
            <v-icon-button @click="sendImages">
              <i-material-symbols:image-outline-rounded />
            </v-icon-button>
            <v-icon-button @click="sendFiles">
              <i-material-symbols:folder-outline-rounded />
            </v-icon-button>
          </div>
        </template>
        <template #trailing-icon>
          <v-icon-button class="btn-send" :disabled="createLoading" @click="handleSend">
            <i-material-symbols:send-outline-rounded />
          </v-icon-button>
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

function onEnterKey(e: KeyboardEvent) {
  if (e.isComposing) return
  e.preventDefault()
  handleSend()
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
  if (__IS_TAURI__) {
    pickImagesViaTauri()
  } else {
    imageInput.value!.value = ''
    imageInput.value!.click()
  }
}

const IMAGE_MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  webp: 'image/webp', bmp: 'image/bmp', heic: 'image/heic', heif: 'image/heif',
  avif: 'image/avif', apng: 'image/apng', tiff: 'image/tiff', tif: 'image/tiff', svg: 'image/svg+xml',
}
const VIDEO_MIME: Record<string, string> = {
  mp4: 'video/mp4', mov: 'video/quicktime', m4v: 'video/x-m4v',
  webm: 'video/webm', mkv: 'video/x-matroska', avi: 'video/x-msvideo',
  '3gp': 'video/3gpp', '3gpp': 'video/3gpp',
}
function mimeFromName(name: string): string {
  const ext = name.toLowerCase().split('.').pop() || ''
  return IMAGE_MIME[ext] || VIDEO_MIME[ext] || ''
}

async function pickImagesViaTauri() {
  const { open } = await import('@tauri-apps/plugin-dialog')
  const { readFile } = await import('@tauri-apps/plugin-fs')
  const selected = await open({
    multiple: true,
    filters: [{
      name: 'Media',
      extensions: [
        'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'heic', 'heif', 'avif', 'apng', 'tiff', 'tif', 'svg',
        'mp4', 'mov', 'm4v', 'webm', 'mkv', 'avi', '3gp', '3gpp',
      ],
    }],
  })
  if (!selected) return
  const paths = (Array.isArray(selected) ? selected : [selected]) as string[]
  const files: File[] = []
  for (const p of paths) {
    const bytes = await readFile(p)
    const name = p.split('/').pop() || 'file'
    files.push(new File([bytes], name, { type: mimeFromName(name) }))
  }
  if (files.length) {
    emit('send-images', files)
  }
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
