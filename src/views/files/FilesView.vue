<template>
  <div class="top-app-bar">
    <v-checkbox touch-target="wrapper" :checked="allChecked" :indeterminate="!allChecked && checked" @change="toggleAllChecked" />
    <div class="title">
      <span v-if="selectedIds.length">{{ $t('x_selected', { count: realAllChecked ? total.toLocaleString() : selectedIds.length.toLocaleString() }) }}</span>
      <div v-else class="breadcrumb">
        <template v-for="(item, index) in breadcrumbPaths" :key="item.path">
          <template v-if="index === 0">
            <span v-if="item.path === filter.parent" v-tooltip="getPageStats()">{{ item.name }} ({{ total }})</span>
            <a v-else v-tooltip="getPageStats()" href="#" @click.stop.prevent="navigateToDir(item.path)">{{ item.name }}</a>
          </template>
          <template v-else>
            <span class="sep">/</span>
            <span v-if="item.path === filter.parent">{{ item.name }} ({{ total }})</span>
            <a v-else href="#" @click.stop.prevent="navigateToDir(item.path)">{{ item.name }}</a>
          </template>
        </template>
      </div>
      <template v-if="checked">
        <v-icon-button v-tooltip="$t('copy')" @click.stop="copyItems">
          <i-material-symbols:content-copy-outline-rounded />
        </v-icon-button>
        <v-icon-button v-tooltip="$t('cut')" @click.stop="cutItems">
          <i-material-symbols:content-cut-rounded />
        </v-icon-button>
        <v-icon-button v-tooltip="$t('delete')" @click.stop="deleteItems">
          <i-material-symbols:delete-forever-outline-rounded />
        </v-icon-button>
        <v-icon-button v-tooltip="$t('download')" :loading="downloadLoading" @click.stop="downloadItems">
          <i-material-symbols:download-rounded />
        </v-icon-button>
      </template>
    </div>

    <div v-if="!isPhone && !checked" class="actions">
      <FilesActionButtons
        :current-dir="filter.parent"
        :can-paste="canPaste()"
        :pasting="pasting"
        :refreshing="refreshing"
        :sorting="sorting"
        :sort-items="sortItems"
        :file-sort-by="fileSortBy"
        @create-dir="createDir"
        @upload-files="uploadFilesClick"
        @upload-dir="uploadDirClick"
        @paste-dir="pasteDir"
        @refresh-current-dir="refreshCurrentDir"
        @sort="sort"
      />
    </div>
  </div>

  <div v-if="isPhone && !checked" class="secondary-actions">
    <FilesActionButtons
      :current-dir="filter.parent"
      :can-paste="canPaste()"
      :pasting="pasting"
      :refreshing="refreshing"
      :sorting="sorting"
      :sort-items="sortItems"
      :file-sort-by="fileSortBy"
      @create-dir="createDir"
      @upload-files="uploadFilesClick"
      @upload-dir="uploadDirClick"
      @paste-dir="pasteDir"
      @refresh-current-dir="refreshCurrentDir"
      @sort="sort"
    />
  </div>

  <div v-if="loading && firstInit" class="scroller-wrapper">
    <div class="scroller main-list">
      <FileSkeletonItem v-for="i in 20" :key="i" :index="i" :is-phone="isPhone" />
    </div>
  </div>
  <div class="scroller-wrapper" @dragover.stop.prevent="fileDragEnter">
    <div v-show="dropping" class="drag-mask" @drop.stop.prevent="dropFiles2" @dragleave.stop.prevent="fileDragLeave">{{ $t('release_to_send_files') }}</div>
    <VirtualList v-if="items.length > 0" class="scroller main-list" :data-key="'id'" :data-sources="items" :estimate-size="80">
      <template #item="{ index, item }">
        <FileListItem
          :item="item"
          :index="index"
          :selected-ids="selectedIds"
          :shift-effecting-ids="shiftEffectingIds"
          :should-select="shouldSelect"
          :is-phone="isPhone"
          :image-error-ids="imageErrorIds"
          :extension-image-error-ids="extensionImageErrorIds"
          :can-paste="canPaste()"
          :handle-item-click="handleItemClick"
          :handle-mouse-over="handleMouseOver"
          :toggle-select="toggleSelect"
          :on-image-error="onImageError"
          :on-extension-image-error="onExtensionImageError"
          :view-item="viewItem"
          :click-item="clickItem"
          @download-dir="downloadDir"
          @download-file="downloadFile"
          @upload-files="uploadFilesClick"
          @upload-dir="uploadDirClick"
          @delete-item="deleteItem"
          @duplicate-item="duplicateItem"
          @cut-item="cutItem"
          @copy-item="copyItem"
          @paste-item="pasteItem"
          @copy-link="copyLinkItem"
          @rename-item="renameItemClick"
          @add-to-favorites="addToFavoritesClick"
        />
      </template>
    </VirtualList>
    <div v-if="!loading && items.length === 0" class="no-data-placeholder">
      {{ $t(noDataKey(loading, app.permissions, 'WRITE_EXTERNAL_STORAGE')) }}
    </div>
    <input ref="fileInput" style="display: none" type="file" multiple @change="uploadChanged" />
    <input ref="dirFileInput" style="display: none" type="file" multiple webkitdirectory mozdirectory directory @change="dirUploadChanged" />
  </div>
</template>

<script setup lang="ts">
import { computed, inject, onActivated, onDeactivated, reactive, ref, watch } from 'vue'
import { formatFileSize } from '@/lib/format'
import { useI18n } from 'vue-i18n'
import { useMainStore } from '@/stores/main'
import { storeToRefs } from 'pinia'
import { type IFile, canOpenInBrowser, canView, getSortItems, enrichFile, isTextFile } from '@/lib/file'
import { getFileName, getFileUrlByPath, getFileId } from '@/lib/api/file'
import { noDataKey } from '@/lib/list'
import emitter from '@/plugins/eventbus'
import { useCreateDir, useRename, useMounts, useDownload, useView, useCopyPaste, useSearch } from '@/hooks/files'
import { useDragDropUpload, useFileUpload } from '@/hooks/upload'
import { useTempStore, type IUploadItem } from '@/stores/temp'
import { openModal } from '@/components/modal'
import DownloadMethodModal from '@/components/DownloadMethodModal.vue'
import DeleteFileConfirm from '@/components/DeleteFileConfirm.vue'
import EditValueModal from '@/components/EditValueModal.vue'
import { useRoute } from 'vue-router'
import { decodeBase64, shortUUID } from '@/lib/strutil'
import { initMutation, setTempValueGQL, addFavoriteFolderGQL } from '@/lib/api/mutation'
import type { ISource } from '@/components/lightbox/types'
import type { IFileDeletedEvent, IFileRenamedEvent, IFileFilter, IBreadcrumbItem, IStorageMount } from '@/lib/interfaces'
import { useSelectable } from '@/hooks/list'
import { useFilesKeyEvents } from '@/hooks/key-events'
import { filesGQL, initLazyQuery } from '@/lib/api/query'
import toast from '@/components/toaster'
import VirtualList from '@/components/virtualscroll'
import { replacePath } from '@/plugins/router'
import { remove } from 'lodash-es'
import { useFilesStore } from '@/stores/files'

const isPhone = inject('isPhone') as boolean
const { t } = useI18n()
const sources = ref([])
const { parseQ, buildQ } = useSearch()
const filter = reactive<IFileFilter>({
  type: '',
  rootPath: '',
  showHidden: false,
  text: '',
  parent: '',
})

const route = useRoute()
const q = ref('')
const items = ref<IFile[]>([])
const { selectedIds, allChecked, realAllChecked, clearSelection, toggleAllChecked, toggleSelect, total, checked, shiftEffectingIds, handleItemClick, handleMouseOver, selectAll, shouldSelect } =
  useSelectable(items)
const { keyDown: pageKeyDown, keyUp: pageKeyUp } = useFilesKeyEvents(selectAll, clearSelection, () => {
  deleteItems()
})
const refreshing = ref(false)
const sorting = ref(false)

const imageErrorIds = ref<string[]>([])
const extensionImageErrorIds = ref<string[]>([])
const onImageError = (id: string) => {
  imageErrorIds.value.push(id)
}
const onExtensionImageError = (id: string) => {
  extensionImageErrorIds.value.push(id)
}

const sortItems = getSortItems()

const mainStore = useMainStore()
const { fileSortBy } = storeToRefs(mainStore)

const tempStore = useTempStore()
const { app, urlTokenKey, uploads } = storeToRefs(tempStore)
const { selectedFiles, isCut } = storeToRefs(useFilesStore())
const { dropping, fileDragEnter, fileDragLeave, dropFiles } = useDragDropUpload(uploads)
const rootDir = computed(() => filter.rootPath)
const { createPath, createVariables, createMutation } = useCreateDir(urlTokenKey, items)
const { renameItem, renameDone, renameMutation, renameVariables } = useRename(() => {
  fetch()
})
const { mounts, refetch: refetchMounts } = useMounts()
const { downloadFile, downloadDir, downloadFiles } = useDownload(urlTokenKey)
const { view } = useView(sources, (s: ISource[], index: number) => {
  tempStore.lightbox = {
    sources: s,
    index: index,
    visible: true,
  }
})

const page = ref(1)
const limit = 10000 // not paging for now

const isActive = ref(false)

function applyRouteQuery() {
  page.value = parseInt(route.query.page?.toString() ?? '1')
  q.value = decodeBase64(route.query.q?.toString() ?? '')
  parseQ(filter, q.value)
}

applyRouteQuery()

const breadcrumbPaths = computed(() => {
  const paths: IBreadcrumbItem[] = []
  let p = filter.parent
  while (p) {
    if (p === rootDir.value) {
      break
    }
    paths.unshift({ path: p, name: getFileName(p) })
    p = p.substring(0, p.lastIndexOf('/'))
  }
  paths.unshift({ path: rootDir.value, name: getPageTitle() })

  return paths
})

const firstInit = ref(true)
const { loading, fetch } = initLazyQuery({
  handle: async (data: any, error: string) => {
    firstInit.value = false
    refreshing.value = false
    sorting.value = false
    if (error) {
      toast(t(error), 'error')
    } else {
      const list: IFile[] = []
      for (const item of data.files) {
        list.push(enrichFile(item, urlTokenKey.value))
      }
      items.value = list
      total.value = list.length
    }
  },
  document: filesGQL,
  variables: () => ({
    root: rootDir.value,
    offset: (page.value - 1) * limit,
    limit,
    query: q.value,
    sortBy: fileSortBy.value,
  }),
  options: {
    fetchPolicy: 'cache-and-network',
  },
})
const { loading: pasting, canPaste, copy, cut, paste } = useCopyPaste(items, isCut, selectedFiles, fetch, refetchMounts)
const { input: fileInput, upload: uploadFiles, uploadChanged } = useFileUpload(uploads)
const { input: dirFileInput, upload: uploadDir, uploadChanged: dirUploadChanged } = useFileUpload(uploads)

const {
  loading: downloadLoading,
  mutate: setTempValue,
  onDone: setTempValueDone,
} = initMutation({
  document: setTempValueGQL,
})

setTempValueDone((r: any) => {
  downloadFiles(r.data.setTempValue.key)
  clearSelection()
})

const downloadItems = () => {
  const selected = items.value.filter((it) => selectedIds.value.includes(it.id))
  if (selected.length === 0) {
    toast(t('select_first'), 'error')
    return
  }

  if (selected.length === 1) {
    const item = selected[0]
    if (item.isDir) {
      downloadDir(item.path)
    } else {
      downloadFile(item.path)
    }
    clearSelection()
    return
  }

  openModal(DownloadMethodModal, {
    onEach: async () => {
      for (const it of selected) {
        if (it.isDir) {
          downloadDir(it.path)
        } else {
          downloadFile(it.path)
        }
        await new Promise((resolve) => setTimeout(resolve, 250))
      }
      clearSelection()
    },
    onZip: () => {
      setTempValue({
        key: shortUUID(),
        value: JSON.stringify(
          selectedIds.value.map((it: string) => ({
            path: it,
          }))
        ),
      })
    },
  })
}

const onDeleted = (files: IFile[]) => {
  files.forEach((f) => {
    remove(items.value, (it: IFile) => it.id === f.id)
  })
  total.value = items.value.length
  clearSelection()
  refetchMounts()
}

const deleteItems = () => {
  openModal(DeleteFileConfirm, {
    files: items.value.filter((it) => selectedIds.value.includes(it.id)),
    onDone: (files: IFile[]) => {
      onDeleted(files)
    },
  })
}

function getPageTitle() {
  if (filter.type === 'SDCARD') {
    return t('sdcard')
  } else if (filter.type === 'APP') {
    return t('app_data')
  } else if (filter.type === 'USB_STORAGE') {
    const usbIndex = app.value.usbDiskPaths.indexOf(filter.rootPath)
    const num = usbIndex !== -1 ? usbIndex + 1 : 1
    return `${t('usb_storage')} ${num}`
  }

  return t('internal_storage')
}

function getPageStats() {
  if (filter.type === 'APP') {
    return t('app_data')
  }

  const v = mounts.value.find((m: IStorageMount) => m.mountPoint === filter.rootPath)
  if (!v) return ''

  return `${t('storage_free_total', {
    free: formatFileSize(v.freeBytes ?? 0),
    total: formatFileSize(v.totalBytes ?? 0),
  })}`
}

function navigateToDir(dir: string) {
  clearSelection()
  filter.parent = dir
  // Clear search text when navigating to a directory to avoid filtering files in the new directory
  filter.text = ''
  const q = buildQ(filter)
  replacePath(mainStore, getUrl(q))
}

function getUrl(q: string) {
  return q ? `/files?q=${q}` : `/files`
}

function clickItem(item: IFile) {
  if (item.isDir) {
    navigateToDir(item.path)
    return
  }
  if (isTextFile(item.name)) {
    // Open text files in new window with custom viewer
    const fileId = getFileId(urlTokenKey.value, item.path)
    window.open(`/text-file?id=${encodeURIComponent(fileId)}`, '_blank')
  } else if (canOpenInBrowser(item.name)) {
    window.open(getFileUrlByPath(urlTokenKey.value, item.path), '_blank')
  } else if (canView(item.name)) {
    view(items.value, item)
  } else {
    downloadFile(item.path)
  }
}

function viewItem(event: Event, item: IFile) {
  if (item.isDir) {
    return
  }

  event.stopPropagation()
  if (isTextFile(item.name)) {
    // Open text files in new window with custom viewer
    const fileId = getFileId(urlTokenKey.value, item.path)
    window.open(`/text-file?id=${encodeURIComponent(fileId)}`, '_blank')
  } else if (canOpenInBrowser(item.name)) {
    window.open(getFileUrlByPath(urlTokenKey.value, item.path), '_blank')
  } else if (canView(item.name)) {
    view(items.value, item)
  } else {
    downloadFile(item.path)
  }
}

function sort(value: string) {
  if (fileSortBy.value === value) {
    return
  }
  sorting.value = true
  fileSortBy.value = value
}

function refreshCurrentDir() {
  refreshing.value = true
  fetch()
}

const createDir = () => {
  createPath.value = filter.parent
  openModal(EditValueModal, {
    title: t('create_folder'),
    placeholder: t('name'),
    mutation: createMutation,
    getVariables: createVariables,
  })
}

function uploadFilesClick(dir: string) {
  uploadFiles(dir)
}

function uploadDirClick(dir: string) {
  uploadDir(dir)
}

function copyItems() {
  copy(selectedIds.value)
  clearSelection()
}

function cutItems() {
  cut(selectedIds.value)
  clearSelection()
}

function pasteDir() {
  paste(filter.parent)
}

function duplicateItem(item: IFile) {
  copy([item.id])
  paste(filter.parent)
}

function cutItem(item: IFile) {
  cut([item.id])
}

function copyItem(item: IFile) {
  copy([item.id])
}

function copyLinkItem(item: IFile) {
  const url = getFileUrlByPath(urlTokenKey.value, item.path)

  // Try modern clipboard API first
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(url)
      .then(() => {
        toast(t('link_copied'))
      })
      .catch(() => {
        fallbackCopyToClipboard(url)
      })
  } else {
    // Fallback for older browsers or non-HTTPS environments
    fallbackCopyToClipboard(url)
  }
}

function fallbackCopyToClipboard(text: string) {
  try {
    // Create a temporary textarea element
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'fixed'
    textArea.style.left = '-999999px'
    textArea.style.top = '-999999px'
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()

    // Try to copy using execCommand
    const successful = document.execCommand('copy')
    document.body.removeChild(textArea)

    if (successful) {
      toast(t('link_copied'))
    } else {
      toast(t('copy_failed'), 'error')
    }
  } catch (err) {
    console.error('Failed to copy text: ', err)
    toast(t('copy_failed'), 'error')
  }
}

function pasteItem(item: IFile) {
  paste(item.path)
}

function renameItemClick(item: IFile) {
  renameItem.value = item
  openModal(EditValueModal, {
    title: t('rename'),
    placeholder: t('name'),
    value: item.name,
    mutation: renameMutation,
    getVariables: renameVariables,
    done: renameDone,
  })
}

function deleteItem(item: IFile) {
  openModal(DeleteFileConfirm, {
    files: [item],
    onDone: onDeleted,
  })
}

const { mutate: addFavoriteFolderMutation, loading: addingFavorite } = initMutation({
  document: addFavoriteFolderGQL,
  options: {
    update: () => {
      // Refetch app data to update favorites list
      emitter.emit('refetch_app')
    },
  },
})

function addToFavoritesClick(item: IFile) {
  if (!item.isDir) {
    return
  }

  // Determine the root path based on the link name
  let rootPath = rootDir.value

  addFavoriteFolderMutation({
    rootPath: rootPath,
    fullPath: item.path,
  })
    .then(() => {
      toast(t('added'))
    })
    .catch((error) => {
      console.error('Error adding favorite folder:', error)
      toast(t('error'), 'error')
    })
}

watch(
  () => route.fullPath,
  () => {
    if (!isActive.value) {
      return
    }
    applyRouteQuery()
    fetch()
  }
)

const uploadTaskDoneHandler = (r: IUploadItem) => {
  if (r.status === 'done') {
    // have to delay 1s to make sure the api return latest data.
    setTimeout(() => {
      fetch()
      refetchMounts()
    }, 1000)
  }
}

const fileDeletedHanlder = (event: IFileDeletedEvent) => {
  onDeleted([event.item])
}

const fileRenamedHandler = (event: IFileRenamedEvent) => {
  // Refresh file list to show new filename
  fetch()
}

function dropFiles2(e: DragEvent) {
  dropFiles(e, filter.parent, () => true)
}

onActivated(() => {
  isActive.value = true
  applyRouteQuery()
  fetch()
  emitter.on('upload_task_done', uploadTaskDoneHandler)
  emitter.on('file_deleted', fileDeletedHanlder)
  emitter.on('file_renamed', fileRenamedHandler)
  window.addEventListener('keydown', pageKeyDown)
  window.addEventListener('keyup', pageKeyUp)
})

onDeactivated(() => {
  isActive.value = false
  emitter.off('upload_task_done', uploadTaskDoneHandler)
  emitter.off('file_deleted', fileDeletedHanlder)
  emitter.off('file_renamed', fileRenamedHandler)
  window.removeEventListener('keydown', pageKeyDown)
  window.removeEventListener('keyup', pageKeyUp)
})
</script>
<style lang="scss" scoped>
.breadcrumb {
  display: inline-flex;
  align-items: center;
  overflow: hidden;

  .sep {
    flex-shrink: 0;
    margin-inline: 4px;
  }

  a, span:not(.sep) {
    max-width: 300px;
    overflow: hidden;
    display: inline-block;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex-shrink: 1;
  }
}
.main-files {
  .scroller-wrapper {
    position: relative;
    height: 100%;
    .drag-mask {
      left: 16px;
      right: 16px;
    }
  }
}
</style>
