<template>
  <div class="top-app-bar">
    <md-checkbox touch-target="wrapper" @change="toggleAllChecked" :checked="allChecked" :indeterminate="!allChecked && checked" />
    <span v-if="selectedIds.length">{{ $t('x_selected', { count: realAllChecked ? total.toLocaleString() : selectedIds.length.toLocaleString() }) }}</span>
    <div v-else class="breadcrumb">
      <template v-for="(item, index) in breadcrumbPaths" :key="item.path">
        <template v-if="index === 0">
          <span v-if="item.path === filter.parent" v-tooltip="getPageStats()">{{ item.name }} ({{ total }})</span>
          <a v-else href="#" @click.stop.prevent="navigateToDir(item.path)" v-tooltip="getPageStats()">{{ item.name }}</a>
        </template>
        <template v-else>
          <span v-if="item.path === filter.parent">{{ item.name }} ({{ total }})</span>
          <a v-else href="#" @click.stop.prevent="navigateToDir(item.path)">{{ item.name }}</a>
        </template>
      </template>
    </div>
    <template v-if="checked">
      <icon-button @click.stop="copyItems" v-tooltip="$t('copy')">
        <template #icon>
          <i-material-symbols:content-copy-outline-rounded />
        </template>
      </icon-button>
      <icon-button @click.stop="cutItems" v-tooltip="$t('cut')">
        <template #icon>
          <i-material-symbols:content-cut-rounded />
        </template>
      </icon-button>
      <icon-button @click.stop="deleteItems" v-tooltip="$t('delete')">
        <template #icon>
          <i-material-symbols:delete-forever-outline-rounded />
        </template>
      </icon-button>
      <icon-button :loading="downloadLoading" @click.stop="downloadItems" v-tooltip="$t('download')">
        <template #icon>
          <i-material-symbols:download-rounded />
        </template>
      </icon-button>
    </template>
    <div class="actions">
      <file-search-input :filter="filter" :parent="rootDir" :get-url="getUrl" />
      <icon-button v-tooltip="$t('create_folder')" @click="createDir">
        <template #icon>
          <i-material-symbols:create-new-folder-outline-rounded />
        </template>
      </icon-button>
      <popper>
        <icon-button v-tooltip="$t('upload')">
          <template #icon>
            <i-material-symbols:upload-rounded />
          </template>
        </icon-button>
        <template #content="slotProps">
          <md-menu-item @click.stop="uploadFilesClick(slotProps, filter.parent)">
            <div slot="headline">{{ $t('upload_files') }}</div>
          </md-menu-item>
          <md-menu-item @click.stop="uploadDirClick(slotProps, filter.parent)">
            <div slot="headline">{{ $t('upload_folder') }}</div>
          </md-menu-item>
        </template>
      </popper>
      <icon-button v-if="canPaste()" :loading="pasting" v-tooltip="$t('paste')" @click="pasteDir">
        <template #icon>
          <i-material-symbols:content-paste-rounded />
        </template>
      </icon-button>
      <icon-button :loading="refreshing" v-tooltip="$t('refresh')" @click="refreshCurrentDir">
        <template #icon>
          <i-material-symbols:refresh-rounded />
        </template>
      </icon-button>
      <popper>
        <icon-button :loading="sorting" v-tooltip="$t('sort')">
          <template #icon>
            <i-material-symbols:sort-rounded />
          </template>
        </icon-button>
        <template #content="slotProps">
          <div class="menu-items">
            <md-menu-item v-for="item in sortItems" @click="sort(slotProps, item.value)" :key="item.value" :selected="item.value === fileSortBy">
              <div slot="headline">{{ $t(item.label) }}</div>
            </md-menu-item>
          </div>
        </template>
      </popper>
    </div>
  </div>
  <div v-if="loading && firstInit" class="scroller">
    <section class="file-item selectable-card-skeleton" v-for="i in 20" :key="i">
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
  <div class="scroller-wrapper" @dragover.stop.prevent="fileDragEnter">
    <div class="drag-mask" v-show="dropping" @drop.stop.prevent="dropFiles2" @dragleave.stop.prevent="fileDragLeave">{{ $t('release_to_send_files') }}</div>
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
            <md-checkbox v-if="shiftEffectingIds.includes(item.id)" class="checkbox" touch-target="wrapper" @click.stop="toggleSelect($event, item, index)" :checked="shouldSelect" />
            <md-checkbox v-else class="checkbox" touch-target="wrapper" @click.stop="toggleSelect($event, item, index)" :checked="selectedIds.includes(item.id)" />
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
              <icon-button class="sm" @click.stop="downloadDir(item.path)" v-tooltip="$t('download')">
                <template #icon>
                  <i-material-symbols:download-rounded />
                </template>
              </icon-button>
              <popper>
                <icon-button class="sm" v-tooltip="$t('upload')">
                  <template #icon>
                    <i-material-symbols:upload-rounded />
                  </template>
                </icon-button>
                <template #content="slotProps">
                  <md-menu-item @click.stop="uploadFilesClick(slotProps, item.path)">
                    <div slot="headline">{{ $t('upload_files') }}</div>
                  </md-menu-item>
                  <md-menu-item @click.stop="uploadDirClick(slotProps, item.path)">
                    <div slot="headline">{{ $t('upload_folder') }}</div>
                  </md-menu-item>
                </template>
              </popper>
            </template>
            <template v-else>
              <icon-button class="sm" @click.stop="downloadFile(item.path)" v-tooltip="$t('download')">
                <template #icon>
                  <i-material-symbols:download-rounded />
                </template>
              </icon-button>
            </template>

            <icon-button class="sm" @click.stop="deleteItem(item)" v-tooltip="$t('delete')">
              <template #icon>
                <i-material-symbols:delete-forever-outline-rounded />
              </template>
            </icon-button>
            <popper>
              <icon-button class="sm" v-tooltip="$t('info')">
                <template #icon>
                  <i-material-symbols:info-outline-rounded />
                </template>
              </icon-button>
              <template #content>
                <section class="card card-info">
                  <div class="key-value vertical">
                    <div class="key">{{ $t('path') }}</div>
                    <div class="value">
                      {{ item.path }}
                    </div>
                  </div>
                </section>
              </template>
            </popper>

            <popper>
              <icon-button class="sm" v-tooltip="$t('actions')">
                <template #icon>
                  <i-material-symbols:more-vert />
                </template>
              </icon-button>
              <template #content="slotProps">
                <md-menu-item @click.stop="duplicateItem(slotProps, item)">
                  <div slot="headline">{{ $t('duplicate') }}</div>
                </md-menu-item>
                <md-menu-item @click.stop="cutItem(slotProps, item)">
                  <div slot="headline">{{ $t('cut') }}</div>
                </md-menu-item>
                <md-menu-item @click.stop="copyItem(slotProps, item)">
                  <div slot="headline">{{ $t('copy') }}</div>
                </md-menu-item>
                <md-menu-item v-if="item.isDir && canPaste()" @click.stop="pasteItme(slotProps, item)">
                  <div slot="headline">{{ $t('paste') }}</div>
                </md-menu-item>
                <md-menu-item @click.stop="renameItemClick(slotProps, item)">
                  <div slot="headline">{{ $t('rename') }}</div>
                </md-menu-item>
              </template>
            </popper>
          </div>
        </section>
      </template>
    </VirtualList>
    <div class="no-data-placeholder" v-if="!loading && items.length === 0">
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
import { type IFile, canOpenInBrowser, canView, getSortItems, enrichFile } from '@/lib/file'
import { getFileName, getFileUrl, getFileUrlByPath } from '@/lib/api/file'
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
import type { MdCheckbox } from '@material/web/checkbox/checkbox'
import type { IFileDeletedEvent, IFileFilter, IBreadcrumbItem } from '@/lib/interfaces'
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
const { keyDown: pageKeyDown, keyUp: pageKeyUp } = useFilesKeyEvents(total, selectAll, clearSelection, () => {})
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
  appApi: true,
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
  appApi: true,
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
    return t('app_name')
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
    return t('app_name')
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
  const q = buildQ(filter)
  replacePath(mainStore, getUrl(q))
}

function getUrl(q: string) {
  return `/files?q=${q}`
}

function clickItem(item: IFile) {
  if (item.isDir) {
    navigateToDir(item.path)
    return
  }
  if (canOpenInBrowser(item.name)) {
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
  if (canOpenInBrowser(item.name)) {
    window.open(getFileUrlByPath(urlTokenKey.value, item.path), '_blank')
  } else if (canView(item.name)) {
    view(items.value, item)
  } else {
    downloadFile(item.path)
  }
}

function sort(slotProps: { close: () => void }, sort: string) {
  // only sort the last column
  sorting.value = true
  fileSortBy.value = sort
  slotProps.close()
}

function refreshCurrentDir() {
  refreshing.value = true
  fetch()
}

const createDir = () => {
  createPath.value = filter.parent
  openModal(EditValueModal, {
    title: t('name'),
    placeholder: t('name'),
    mutation: createMutation,
    getVariables: createVariables,
  })
}

function uploadFilesClick(slotProps: { close: () => void }, dir: string) {
  uploadFiles(dir)
  slotProps.close()
}

function uploadDirClick(slotProps: { close: () => void }, dir: string) {
  uploadDir(dir)
  slotProps.close()
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

function duplicateItem(slotProps: { close: () => void }, item: IFile) {
  copy([item.id])
  paste(filter.parent)
  slotProps.close()
}

function cutItem(slotProps: { close: () => void }, item: IFile) {
  cut([item.id])
  slotProps.close()
}

function copyItem(slotProps: { close: () => void }, item: IFile) {
  copy([item.id])
  slotProps.close()
}

function pasteItme(slotProps: { close: () => void }, item: IFile) {
  paste(item.path)
  slotProps.close()
}

function renameItemClick(slotProps: { close: () => void }, item: IFile) {
  renameItem.value = item
  openModal(EditValueModal, {
    title: t('rename'),
    placeholder: t('name'),
    value: item.name,
    mutation: renameMutation,
    getVariables: renameVariables,
    done: renameDone,
  })
  slotProps.close()
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

function dropFiles2(e: DragEvent) {
  dropFiles(e, filter.parent)
}

onActivated(() => {
  q.value = decodeBase64(query.q?.toString() ?? '')
  parseQ(filter, q.value)
  fetch()
  emitter.on('upload_task_done', uploadTaskDoneHandler)
  emitter.on('file_deleted', fileDeletedHanlder)
  window.addEventListener('keydown', pageKeyDown)
  window.addEventListener('keyup', pageKeyUp)
})

onDeactivated(() => {
  emitter.off('upload_task_done', uploadTaskDoneHandler)
  emitter.off('file_deleted', fileDeletedHanlder)
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
