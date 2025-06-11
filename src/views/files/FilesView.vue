<template>
  <div class="top-app-bar">
    <v-checkbox touch-target="wrapper" :checked="allChecked" :indeterminate="!allChecked && checked" @change="toggleAllChecked" />
    <span v-if="selectedIds.length">{{ $t('x_selected', { count: realAllChecked ? total.toLocaleString() : selectedIds.length.toLocaleString() }) }}</span>
    <div v-else class="breadcrumb">
      <template v-for="(item, index) in breadcrumbPaths" :key="item.path">
        <template v-if="index === 0">
          <span v-if="item.path === filter.parent" v-tooltip="getPageStats()">{{ item.name }} ({{ total }})</span>
          <a v-else v-tooltip="getPageStats()" href="#" @click.stop.prevent="navigateToDir(item.path)">{{ item.name }}</a>
        </template>
        <template v-else>
          <span v-if="item.path === filter.parent">{{ item.name }} ({{ total }})</span>
          <a v-else href="#" @click.stop.prevent="navigateToDir(item.path)">{{ item.name }}</a>
        </template>
      </template>
    </div>
    <template v-if="checked">
      <v-icon-button v-tooltip="$t('copy')" @click.stop="copyItems">
        <template #icon>
          <i-material-symbols:content-copy-outline-rounded />
        </template>
      </v-icon-button>
      <v-icon-button v-tooltip="$t('cut')" @click.stop="cutItems">
        <template #icon>
          <i-material-symbols:content-cut-rounded />
        </template>
      </v-icon-button>
      <v-icon-button v-tooltip="$t('delete')" @click.stop="deleteItems">
        <template #icon>
          <i-material-symbols:delete-forever-outline-rounded />
        </template>
      </v-icon-button>
      <v-icon-button v-tooltip="$t('download')" :loading="downloadLoading" @click.stop="downloadItems">
        <template #icon>
          <i-material-symbols:download-rounded />
        </template>
      </v-icon-button>
    </template>
    <div class="actions">
      <file-search-input :filter="filter" :parent="rootDir" :get-url="getUrl" :navigate-to-dir="navigateToDir" />
      <v-icon-button v-tooltip="$t('create_folder')" @click="createDir">
        <template #icon>
          <i-material-symbols:create-new-folder-outline-rounded />
        </template>
      </v-icon-button>
      <v-dropdown v-model="uploadMenuVisible">
        <template #trigger>
          <v-icon-button v-tooltip="$t('upload')">
            <template #icon>
              <i-material-symbols:upload-rounded />
            </template>
          </v-icon-button>
        </template>
        <div class="dropdown-item" @click.stop="uploadFilesClick(filter.parent); uploadMenuVisible = false">
          {{ $t('upload_files') }}
        </div>
        <div class="dropdown-item" @click.stop="uploadDirClick(filter.parent); uploadMenuVisible = false">
          {{ $t('upload_folder') }}
        </div>
      </v-dropdown>
      <v-icon-button v-if="canPaste()" v-tooltip="$t('paste')" :loading="pasting" @click="pasteDir">
        <template #icon>
          <i-material-symbols:content-paste-rounded />
        </template>
      </v-icon-button>
      <v-icon-button v-tooltip="$t('refresh')" :loading="refreshing" @click="refreshCurrentDir">
        <template #icon>
          <i-material-symbols:refresh-rounded />
        </template>
      </v-icon-button>
      <v-dropdown v-model="sortMenuVisible">
        <template #trigger>
          <v-icon-button v-tooltip="$t('sort')" :loading="sorting">
            <template #icon>
              <i-material-symbols:sort-rounded />
            </template>
          </v-icon-button>
        </template>
        <div v-for="item in sortItems" :key="item.value" class="dropdown-item" :class="{ 'selected': item.value === fileSortBy }" @click="sort(item.value); sortMenuVisible = false">
          {{ $t(item.label) }}
        </div>
      </v-dropdown>
    </div>
  </div>
  <div v-if="loading && firstInit" class="scroller-wrapper">
    <div class="scroller">
      <section v-for="i in 20" :key="i" class="file-item selectable-card-skeleton">
        <div class="start">
          <div class="checkbox">
            <div class="skeleton-checkbox"></div>
          </div>
          <span class="number">{{ i }}</span>
        </div>
        <div class="image">
          <div class="skeleton-image"></div>
        </div>
        <div class="title">
          <div class="skeleton-text skeleton-title"></div>
        </div>
        <div class="subtitle">
          <div class="skeleton-text skeleton-subtitle"></div>
        </div>
        <div class="actions">
          <div class="skeleton-text skeleton-actions"></div>
        </div>
      </section>
    </div>
  </div>
  <div class="scroller-wrapper" @dragover.stop.prevent="fileDragEnter">
    <div v-show="dropping" class="drag-mask" @drop.stop.prevent="dropFiles2" @dragleave.stop.prevent="fileDragLeave">{{ $t('release_to_send_files') }}</div>
    <VirtualList v-if="items.length > 0" class="scroller" :data-key="'id'" :data-sources="items" :estimate-size="80">
      <template #item="{ index, item }">
        <section
          class="file-item selectable-card"
          :class="{ selected: selectedIds.includes(item.id), selecting: shiftEffectingIds.includes(item.id) }"
          @click.stop="
            handleItemClick($event, item, index, () => {
              clickItem(item)
            })
          "
          @mouseover="handleMouseOver($event, index)"
        >
          <div class="start">
            <v-checkbox v-if="shiftEffectingIds.includes(item.id)" class="checkbox" touch-target="wrapper" :checked="shouldSelect" @click.stop="toggleSelect($event, item, index)" />
            <v-checkbox v-else class="checkbox" touch-target="wrapper" :checked="selectedIds.includes(item.id)" @click.stop="toggleSelect($event, item, index)" />
            <span class="number"><field-id :id="index + 1" :raw="item" /></span>
          </div>

          <div class="image" @click="viewItem($event, item)">
            <img v-if="item.isDir" :src="`/ficons/folder.svg`" class="svg" />
            <template v-else>
              <img v-if="extensionImageErrorIds.includes(item.id)" class="svg" src="/ficons/default.svg" />
              <img v-else-if="!imageErrorIds.includes(item.id) && item.fileId" class="image-thumb" :src="getFileUrl(item.fileId, '&w=50&h=50')" @error="onImageError(item.id)" />
              <img v-else-if="item.extension" :src="`/ficons/${item.extension}.svg`" class="svg" @error="onExtensionImageError(item.id)" />
              <img v-else class="svg" src="/ficons/default.svg" />
            </template>
          </div>
          <div class="title">
            {{ item.name }}
          </div>
          <div class="subtitle">
            <span v-if="item.isDir">{{ $t('x_items', item.children) }}</span>
            <span v-else>{{ formatFileSize(item.size) }}</span>
            <span v-tooltip="formatDateTime(item.updatedAt)">{{ formatTimeAgo(item.updatedAt) }}</span>
          </div>
          <div class="actions">
            <template v-if="item.isDir">
              <v-icon-button v-tooltip="$t('download')" class="sm" @click.stop="downloadDir(item.path)">
                <template #icon>
                  <i-material-symbols:download-rounded />
                </template>
              </v-icon-button>
              <v-dropdown v-model="uploadItemMenuVisible[item.id]">
                <template #trigger>
                  <v-icon-button v-tooltip="$t('upload')" class="sm">
                    <template #icon>
                      <i-material-symbols:upload-rounded />
                    </template>
                  </v-icon-button>
                </template>
                <div class="dropdown-item" @click.stop="uploadFilesClick(item.path); uploadItemMenuVisible[item.id] = false">
                  {{ $t('upload_files') }}
                </div>
                <div class="dropdown-item" @click.stop="uploadDirClick(item.path); uploadItemMenuVisible[item.id] = false">
                  {{ $t('upload_folder') }}
                </div>
              </v-dropdown>
            </template>
            <template v-else>
              <v-icon-button v-tooltip="$t('download')" class="sm" @click.stop="downloadFile(item.path)">
                <template #icon>
                  <i-material-symbols:download-rounded />
                </template>
              </v-icon-button>
            </template>

            <v-icon-button v-tooltip="$t('delete')" class="sm" @click.stop="deleteItem(item)">
              <template #icon>
                <i-material-symbols:delete-forever-outline-rounded />
              </template>
            </v-icon-button>
            <v-dropdown v-model="infoMenuVisible[item.id]">
              <template #trigger>
                <v-icon-button v-tooltip="$t('info')" class="sm">
                  <template #icon>
                    <i-material-symbols:info-outline-rounded />
                  </template>
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

            <v-dropdown v-model="actionsMenuVisible[item.id]">
              <template #trigger>
                <v-icon-button v-tooltip="$t('actions')" class="sm">
                  <template #icon>
                    <i-material-symbols:more-vert />
                  </template>
                </v-icon-button>
              </template>
              <div class="dropdown-item" @click.stop="duplicateItem(item); actionsMenuVisible[item.id] = false">
                {{ $t('duplicate') }}
              </div>
              <div class="dropdown-item" @click.stop="cutItem(item); actionsMenuVisible[item.id] = false">
                {{ $t('cut') }}
              </div>
              <div class="dropdown-item" @click.stop="copyItem(item); actionsMenuVisible[item.id] = false">
                {{ $t('copy') }}
              </div>
              <div v-if="item.isDir && canPaste()" class="dropdown-item" @click.stop="pasteItem(item); actionsMenuVisible[item.id] = false">
                {{ $t('paste') }}
              </div>
              <div v-if="!item.isDir" class="dropdown-item" @click.stop="copyLinkItem(item); actionsMenuVisible[item.id] = false">
                {{ $t('copy_link') }}
              </div>
              <div class="dropdown-item" @click.stop="renameItemClick(item); actionsMenuVisible[item.id] = false">
                {{ $t('rename') }}
              </div>
            </v-dropdown>
          </div>
        </section>
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
import { computed, onActivated, onDeactivated, reactive, ref } from 'vue'
import { formatDateTime, formatFileSize, formatTimeAgo } from '@/lib/format'
import { useI18n } from 'vue-i18n'
import { useMainStore } from '@/stores/main'
import { storeToRefs } from 'pinia'
import { type IFile, canOpenInBrowser, canView, getSortItems, enrichFile, isTextFile } from '@/lib/file'
import { getFileName, getFileUrl, getFileUrlByPath, getFileId } from '@/lib/api/file'
import { noDataKey } from '@/lib/list'
import emitter from '@/plugins/eventbus'
import { useCreateDir, useRename, useStats, useDownload, useView, useCopyPaste, getRootDir, useSearch } from '@/hooks/files'
import { useDragDropUpload, useFileUpload } from '@/hooks/upload'
import { useTempStore, type IUploadItem } from '@/stores/temp'
import { openModal } from '@/components/modal'
import DeleteFileConfirm from '@/components/DeleteFileConfirm.vue'
import EditValueModal from '@/components/EditValueModal.vue'
import { useRoute } from 'vue-router'
import { decodeBase64, shortUUID } from '@/lib/strutil'
import { initMutation, setTempValueGQL } from '@/lib/api/mutation'
import type { ISource } from '@/components/lightbox/types'
import type { IFileDeletedEvent, IFileRenamedEvent, IFileFilter, IBreadcrumbItem } from '@/lib/interfaces'
import { useSelectable } from '@/hooks/list'
import { useFilesKeyEvents } from '@/hooks/key-events'
import { filesGQL, initLazyQuery } from '@/lib/api/query'
import toast from '@/components/toaster'
import VirtualList from '@/components/virtualscroll'
import { replacePath } from '@/plugins/router'
import { remove } from 'lodash-es'
import { useFilesStore } from '@/stores/files'

const { t } = useI18n()
const sources = ref([])
const { parseQ, buildQ } = useSearch()
const filter = reactive<IFileFilter>({
  linkName: '',
  showHidden: false,
  text: '',
  parent: '',
})

const route = useRoute()
const query = route.query
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
const rootDir = computed(() => getRootDir(filter.linkName, app.value))
const { createPath, createVariables, createMutation } = useCreateDir(urlTokenKey, items)
const { renameItem, renameDone, renameMutation, renameVariables } = useRename(() => {
  fetch()
})
const { internal, sdcard, usb, refetch: refetchStats } = useStats()
const { downloadFile, downloadDir, downloadFiles } = useDownload(urlTokenKey)
const { view } = useView(sources, (s: ISource[], index: number) => {
  tempStore.lightbox = {
    sources: s,
    index: index,
    visible: true,
  }
})

const page = ref(parseInt(query.page?.toString() ?? '1'))
const limit = 10000 // not paging for now

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
const { loading: pasting, canPaste, copy, cut, paste } = useCopyPaste(items, isCut, selectedFiles, fetch, refetchStats)
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
  setTempValue({
    key: shortUUID(),
    value: JSON.stringify(
      selectedIds.value.map((it: string) => ({
        path: it,
      }))
    ),
  })
}

const onDeleted = (files: IFile[]) => {
  files.forEach((f) => {
    remove(items.value, (it: IFile) => it.id === f.id)
  })
  total.value = items.value.length
  clearSelection()
  refetchStats()
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
  if (filter.linkName === 'sdcard') {
    return t('sdcard')
  } else if (filter.linkName === 'app') {
    return t('app_data')
  } else if (filter.linkName.startsWith('usb')) {
    const num = parseInt(filter.linkName.substring(3))
    return `${t('usb_storage')} ${num}`
  }

  return t('internal_storage')
}

function getPageStats() {
  if (filter.linkName === 'sdcard') {
    return `${t('storage_free_total', {
      free: formatFileSize(sdcard.value?.freeBytes ?? 0),
      total: formatFileSize(sdcard.value?.totalBytes ?? 0),
    })}`
  } else if (filter.linkName === 'app') {
    return t('app_data')
  } else if (filter.linkName.startsWith('usb')) {
    const num = parseInt(filter.linkName.substring(3))
    const u = usb.value[num - 1]
    return `${t('storage_free_total', {
      free: formatFileSize(u?.freeBytes ?? 0),
      total: formatFileSize(u?.totalBytes ?? 0),
    })}`
  }

  return `${formatFileSize(internal.value?.freeBytes ?? 0)} / ${formatFileSize(internal.value?.totalBytes ?? 0, true, 0)}`
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
    navigator.clipboard.writeText(url).then(() => {
      toast(t('link_copied'), 'success')
    }).catch(() => {
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
      toast(t('link_copied'), 'success')
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

const uploadTaskDoneHandler = (r: IUploadItem) => {
  if (r.status === 'done') {
    // have to delay 1s to make sure the api return latest data.
    setTimeout(() => {
      fetch()
      refetchStats()
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
  dropFiles(e, filter.parent)
}

const uploadMenuVisible = ref(false)
const sortMenuVisible = ref(false)
const uploadItemMenuVisible = ref<Record<string, boolean>>({})
const infoMenuVisible = ref<Record<string, boolean>>({})
const actionsMenuVisible = ref<Record<string, boolean>>({})

onActivated(() => {
  q.value = decodeBase64(query.q?.toString() ?? '')
  parseQ(filter, q.value)
  fetch()
  emitter.on('upload_task_done', uploadTaskDoneHandler)
  emitter.on('file_deleted', fileDeletedHanlder)
  emitter.on('file_renamed', fileRenamedHandler)
  window.addEventListener('keydown', pageKeyDown)
  window.addEventListener('keyup', pageKeyUp)
})

onDeactivated(() => {
  emitter.off('upload_task_done', uploadTaskDoneHandler)
  emitter.off('file_deleted', fileDeletedHanlder)
  emitter.off('file_renamed', fileRenamedHandler)
  window.removeEventListener('keydown', pageKeyDown)
  window.removeEventListener('keyup', pageKeyUp)
})
</script>
<style lang="scss" scoped>
.breadcrumb {
  a {
    &:not(:last-child) {
      &::after {
        content: '/';
        margin-inline: 4px;
      }
    }
  }
}
.main-files {
  .file-item {
    grid-template-columns: 48px 50px auto 200px;
  }
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
