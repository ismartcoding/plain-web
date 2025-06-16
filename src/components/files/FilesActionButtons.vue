<template>
  <files-keyboard-shortcuts />
  <v-icon-button v-tooltip="$t('create_folder')" @click="createDir">
      <i-material-symbols:create-new-folder-outline-rounded />
  </v-icon-button>
  <v-dropdown v-model="uploadMenuVisible">
    <template #trigger>
      <v-icon-button v-tooltip="$t('upload')">
          <i-material-symbols:upload-rounded />
      </v-icon-button>
    </template>
    <div class="dropdown-item" @click.stop="uploadFilesClick(currentDir); uploadMenuVisible = false">
      {{ $t('upload_files') }}
    </div>
    <div class="dropdown-item" @click.stop="uploadDirClick(currentDir); uploadMenuVisible = false">
      {{ $t('upload_folder') }}
    </div>
  </v-dropdown>
  <v-icon-button v-if="canPaste" v-tooltip="$t('paste')" :loading="pasting" @click="pasteDir">
      <i-material-symbols:content-paste-rounded />
  </v-icon-button>
  <v-icon-button v-tooltip="$t('refresh')" :loading="refreshing" @click="refreshCurrentDir">
      <i-material-symbols:refresh-rounded />
  </v-icon-button>
  <v-dropdown v-model="sortMenuVisible">
    <template #trigger>
      <v-icon-button v-tooltip="$t('sort')" :loading="sorting">
          <i-material-symbols:sort-rounded />
      </v-icon-button>
    </template>
    <div v-for="item in sortItems" :key="item.value" class="dropdown-item" :class="{ 'selected': item.value === fileSortBy }" @click="sort(item.value); sortMenuVisible = false">
      {{ $t(item.label) }}
    </div>
  </v-dropdown>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps({
  currentDir: {
    type: String,
    required: true,
  },
  canPaste: {
    type: Boolean,
    required: true,
  },
  pasting: {
    type: Boolean,
    required: true,
  },
  refreshing: {
    type: Boolean,
    required: true,
  },
  sorting: {
    type: Boolean,
    required: true,
  },
  sortItems: {
    type: Array as () => { value: string; label: string }[],
    required: true,
  },
  fileSortBy: {
    type: String,
    required: true,
  },
})

const emit = defineEmits<{
  createDir: []
  uploadFiles: [dir: string]
  uploadDir: [dir: string]
  pasteDir: []
  refreshCurrentDir: []
  sort: [value: string]
}>()

const uploadMenuVisible = ref(false)
const sortMenuVisible = ref(false)

function createDir() {
  emit('createDir')
}

function uploadFilesClick(dir: string) {
  emit('uploadFiles', dir)
}

function uploadDirClick(dir: string) {
  emit('uploadDir', dir)
}

function pasteDir() {
  emit('pasteDir')
}

function refreshCurrentDir() {
  emit('refreshCurrentDir')
}

function sort(value: string) {
  emit('sort', value)
}
</script> 