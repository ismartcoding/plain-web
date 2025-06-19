<template>
  <div class="actions">
    <template v-if="item.isDir">
      <v-icon-button v-tooltip="$t('download')" class="sm" @click.stop="downloadDir(item.path)">
          <i-material-symbols:download-rounded />
      </v-icon-button>
      <v-dropdown v-model="uploadMenuVisible">
        <template #trigger>
          <v-icon-button v-tooltip="$t('upload')" class="sm">
              <i-material-symbols:upload-rounded />
          </v-icon-button>
        </template>
        <div class="dropdown-item" @click.stop="uploadFiles(item.path); uploadMenuVisible = false">
          {{ $t('upload_files') }}
        </div>
        <div class="dropdown-item" @click.stop="uploadDir(item.path); uploadMenuVisible = false">
          {{ $t('upload_folder') }}
        </div>
      </v-dropdown>
    </template>
    <template v-else>
      <v-icon-button v-tooltip="$t('download')" class="sm" @click.stop="downloadFile(item.path)">
          <i-material-symbols:download-rounded />
      </v-icon-button>
    </template>

    <v-icon-button v-tooltip="$t('delete')" class="sm" @click.stop="deleteItem(item)">
        <i-material-symbols:delete-forever-outline-rounded />
    </v-icon-button>
    
    <v-dropdown v-model="infoMenuVisible">
      <template #trigger>
        <v-icon-button v-tooltip="$t('info')" class="sm">
            <i-material-symbols:info-outline-rounded />
        </v-icon-button>
      </template>
      <section class="card card-info">
        <div class="key-value vertical">
          <div class="key">{{ $t('path') }}</div>
          <div class="value">
            {{ item.path }}
          </div>
        </div>
      </section>
    </v-dropdown>

    <v-dropdown v-model="actionsMenuVisible">
      <template #trigger>
        <v-icon-button v-tooltip="$t('actions')" class="sm">
            <i-material-symbols:more-vert />
        </v-icon-button>
      </template>
      <div class="dropdown-item" @click.stop="duplicateItem(item); actionsMenuVisible = false">
        {{ $t('duplicate') }}
      </div>
      <div class="dropdown-item" @click.stop="cutItem(item); actionsMenuVisible = false">
        {{ $t('cut') }}
      </div>
      <div class="dropdown-item" @click.stop="copyItem(item); actionsMenuVisible = false">
        {{ $t('copy') }}
      </div>
      <div v-if="item.isDir && canPaste" class="dropdown-item" @click.stop="pasteItem(item); actionsMenuVisible = false">
        {{ $t('paste') }}
      </div>
      <div v-if="!item.isDir" class="dropdown-item" @click.stop="copyLink(item); actionsMenuVisible = false">
        {{ $t('copy_link') }}
      </div>
      <div class="dropdown-item" @click.stop="renameItem(item); actionsMenuVisible = false">
        {{ $t('rename') }}
      </div>
    </v-dropdown>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { IFile } from '@/lib/file'

interface Props {
  item: IFile
  canPaste: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  downloadDir: [path: string]
  downloadFile: [path: string]
  uploadFiles: [path: string]
  uploadDir: [path: string]
  deleteItem: [item: IFile]
  duplicateItem: [item: IFile]
  cutItem: [item: IFile]
  copyItem: [item: IFile]
  pasteItem: [item: IFile]
  copyLink: [item: IFile]
  renameItem: [item: IFile]
}>()

const uploadMenuVisible = ref(false)
const infoMenuVisible = ref(false)
const actionsMenuVisible = ref(false)

function downloadDir(path: string) {
  emit('downloadDir', path)
}

function downloadFile(path: string) {
  emit('downloadFile', path)
}

function uploadFiles(path: string) {
  emit('uploadFiles', path)
}

function uploadDir(path: string) {
  emit('uploadDir', path)
}

function deleteItem(item: IFile) {
  emit('deleteItem', item)
}

function duplicateItem(item: IFile) {
  emit('duplicateItem', item)
}

function cutItem(item: IFile) {
  emit('cutItem', item)
}

function copyItem(item: IFile) {
  emit('copyItem', item)
}

function pasteItem(item: IFile) {
  emit('pasteItem', item)
}

function copyLink(item: IFile) {
  emit('copyLink', item)
}

function renameItem(item: IFile) {
  emit('renameItem', item)
}
</script>

<style scoped lang="scss">
.actions {
  display: flex;
  gap: 4px;
  align-items: center;
  
  &.mobile {
    flex-wrap: wrap;
  }
}
</style> 