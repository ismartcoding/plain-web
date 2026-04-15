<template>
  <div class="top-app-bar">
    <v-checkbox touch-target="wrapper" :checked="allChecked" :indeterminate="!allChecked && checked" @change="toggleAllChecked" />
    <div class="title">
      <span v-if="selectedIds.length">{{ $t('x_selected', { count: realAllChecked ? total.toLocaleString() : selectedIds.length.toLocaleString() }) }}</span>
      <span v-else>{{ $t('page_title.docs') }} ({{ total.toLocaleString() }})</span>
      <template v-if="checked">
        <v-icon-button v-tooltip="$t('delete')" @click.stop="deleteSelected">
          <i-material-symbols:delete-forever-outline-rounded />
        </v-icon-button>
        <v-icon-button v-tooltip="$t('download')" @click.stop="downloadSelected">
          <i-material-symbols:download-rounded />
        </v-icon-button>
      </template>
    </div>
    <div v-if="!checked" class="actions">
      <v-dropdown v-model="uploadMenuVisible">
        <template #trigger>
          <v-icon-button v-tooltip="$t('upload')">
            <i-material-symbols:upload-rounded />
          </v-icon-button>
        </template>
        <div class="dropdown-item" @click.stop="uploadFilesClick(); uploadMenuVisible = false">{{ $t('upload_files') }}</div>
        <div class="dropdown-item" @click.stop="uploadDirClick(); uploadMenuVisible = false">{{ $t('upload_folder') }}</div>
      </v-dropdown>
      <v-dropdown v-model="sortMenuVisible">
        <template #trigger>
          <v-icon-button v-tooltip="$t('sort')" :loading="sorting">
            <i-material-symbols:sort-rounded />
          </v-icon-button>
        </template>
        <div v-for="item in sortItems" :key="item.value" class="dropdown-item" :class="{ selected: item.value === docSortBy }" @click="sort(item.value); sortMenuVisible = false">
          {{ $t(item.label) }}
        </div>
      </v-dropdown>
    </div>
  </div>

  <all-checked-alert :limit="limit" :total="total" :all-checked-alert-visible="allCheckedAlertVisible"
    :real-all-checked="realAllChecked" :select-real-all="selectRealAll" :clear-selection="clearSelection" />

  <div class="scroll-content" @dragover.stop.prevent="fileDragEnter">
    <div v-show="dropping" class="drag-mask" @drop.stop.prevent="dropFilesOnDocs" @dragleave.stop.prevent="fileDragLeave">
      {{ $t('release_to_send_files') }}
    </div>
    <div class="main-list" :class="{ 'select-mode': checked }">
      <template v-if="loading && items.length === 0">
        <DocSkeletonItem v-for="i in 20" :key="i" :index="i" />
      </template>
      <DocListItem
        v-for="(item, i) in items"
        :key="item.id"
        :item="item"
        :index="i"
        :selected-ids="selectedIds"
        :shift-effecting-ids="shiftEffectingIds"
        :should-select="shouldSelect"
        :handle-item-click="handleItemClick"
        :handle-mouse-over="handleMouseOver"
        :toggle-select="toggleSelect"
        @download-file="downloadFile"
        @delete-item="deleteItem"
        @open-file="openFile"
        @rename-item="renameItem"
        @duplicate-item="duplicateItem"
      />
    </div>
    <div v-if="!loading && items.length === 0" class="no-data-placeholder">
      {{ $t(noDataKey(loading, app.permissions, 'WRITE_EXTERNAL_STORAGE')) }}
    </div>
    <v-pagination v-if="total > limit" :page="page" :go="gotoPage" :total="total" :limit="limit" :page-size="limit" :on-change-page-size="onChangePageSize" />
  </div>

  <input ref="fileInput" style="display: none" type="file" multiple accept=".doc,.docx,.xls,.xlsx,.ppt,.pptx,.pdf,.txt,.md,.csv,.json,.xml,.js,.ts,.py,.java,.kt,.swift,.c,.cpp,.h,.cs,.go,.rs,.rb,.sh,.yaml,.yml,.toml,.ini,.cfg,.log" @change="uploadChanged" />
  <input ref="dirFileInput" style="display: none" type="file" multiple webkitdirectory mozdirectory directory @change="dirUploadChanged" />
</template>

<script setup lang="ts">
import { onActivated, onDeactivated, ref } from 'vue'
import { noDataKey } from '@/lib/list'
import { getSortItems } from '@/lib/file'
import { useTempStore } from '@/stores/temp'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import DocListItem from './DocListItem.vue'
import DocSkeletonItem from './DocSkeletonItem.vue'
import { useDocsData } from './hooks/useDocsData'
import { useDocsActions } from './hooks/useDocsActions'
import { useFileUpload, useDragDropUpload } from '@/hooks/upload'
import { pickUploadDir } from '@/lib/upload/pick-upload-dir'
import emitter from '@/plugins/eventbus'

const sortItems = getSortItems()
const sortMenuVisible = ref(false)
const uploadMenuVisible = ref(false)
const { urlTokenKey, uploads } = storeToRefs(useTempStore())
const { t } = useI18n()

const {
  items, page, limit, q, loading, fetch, sorting, isActive,
  app, docSortBy, selectedIds, allChecked, realAllChecked, selectRealAll,
  allCheckedAlertVisible, clearSelection, toggleAllChecked, toggleSelect, total, checked,
  shiftEffectingIds, handleItemClick, handleMouseOver, shouldSelect,
  gotoPage, onChangePageSize, sort, applyRouteQuery,
} = useDocsData()

const { downloadFile, openFile, deleteItem, deleteSelected, renameItem, duplicateItem, downloadSelected } =
  useDocsActions(items, selectedIds, clearSelection, fetch, urlTokenKey)

const { input: fileInput, upload: uploadFiles, uploadChanged } = useFileUpload(uploads)
const { input: dirFileInput, upload: uploadDirFiles, uploadChanged: dirUploadChanged } = useFileUpload(uploads)
const { dropping, fileDragEnter, fileDragLeave, dropFiles } = useDragDropUpload(uploads)

async function resolveUploadDir() {
  return pickUploadDir({
    title: t('upload_select_destination'),
    description: t('upload_select_destination_desc'),
    modalId: 'upload-directory-picker-docs',
    storageKey: 'plainweb.uploadDir.docs',
  })
}

async function uploadFilesClick() { const dir = await resolveUploadDir(); if (dir) uploadFiles(dir) }
async function uploadDirClick() { const dir = await resolveUploadDir(); if (dir) uploadDirFiles(dir) }
function dropFilesOnDocs(e: DragEvent) { dropFiles(e, resolveUploadDir, () => true) }

const onUploadDone = () => { setTimeout(() => fetch(), 1000) }

onActivated(() => {
  isActive.value = true
  applyRouteQuery()
  emitter.on('upload_task_done', onUploadDone)
})

onDeactivated(() => {
  isActive.value = false
  emitter.off('upload_task_done', onUploadDone)
})
</script>

<style scoped lang="scss">
:deep(.doc-item) {
  grid-template-areas:
    'start icon title actions'
    'start icon subtitle actions';
  grid-template-columns: 48px 40px 1fr auto;
  align-items: center;

  &:hover { cursor: pointer; }

  .doc-icon {
    grid-area: icon;
    display: flex;
    align-items: center;
    margin-block: 10px 8px;
    .svg { width: 32px; height: 32px; object-fit: contain; }
  }

  .title {
    grid-area: title;
    padding-block-start: 8px;
  }

  .subtitle {
    grid-area: subtitle;
    display: flex;
    gap: 12px;
    color: var(--md-sys-color-secondary);
    font-size: 0.85rem;
    margin-block-end: 8px;
  }

  .actions { grid-area: actions; }
}
</style>