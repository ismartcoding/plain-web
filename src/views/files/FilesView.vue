<template>
  <aside class="sidebar2">
    <div class="top-app-bar">
      <md-checkbox touch-target="wrapper" @change="toggleAllChecked" :checked="allChecked" :indeterminate="!allChecked && checked" />
      <span v-if="selectedIds.length">{{ $t('x_selected', { count: realAllChecked ? total.toLocaleString() : selectedIds.length.toLocaleString() }) }}</span>
      <div v-else class="breadcrumb">
        <template v-for="item of breadcrumbPaths" :key="item.path">
          <span v-if="item.path === currentDir">{{ item.name }}</span>
          <a v-else href="#" @click.stop.prevent="currentDir = item.path">{{ item.name }}</a>
        </template>
      </div>
      <template v-if="checked">
        <button class="btn-icon" @click.stop="() => copy(selectedIds)" v-tooltip="$t('copy')">
          <md-ripple />
          <i-material-symbols:content-copy-outline-rounded />
        </button>
        <button class="btn-icon" @click.stop="() => cut(selectedIds)" v-tooltip="$t('cut')">
          <md-ripple />
          <i-material-symbols:content-cut-rounded />
        </button>
        <button class="btn-icon" @click.stop="deleteItems" v-tooltip="$t('delete')">
          <md-ripple />
          <i-material-symbols:delete-forever-outline-rounded />
        </button>
        <button class="btn-icon" @click.stop="downloadItems" v-tooltip="$t('download')">
          <md-ripple />
          <i-material-symbols:download-rounded />
        </button>
      </template>
      <div class="actions">
        <div class="form-check">
          <label class="form-check-label"><md-checkbox touch-target="wrapper" @change="toggleShowHiddenChecked" :checked="fileShowHidden" />{{ $t('show_hidden') }}</label>
        </div>
        <button class="btn-icon btn-refresh" v-tooltip="$t('refresh')" @click="refreshCurrentDir">
          <md-ripple />
          <i-material-symbols:refresh-rounded />
        </button>
        <popper>
          <button class="btn-icon btn-sort" v-tooltip="$t('sort')">
            <md-ripple />
            <i-material-symbols:sort-rounded />
          </button>
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

    <div v-if="loading && items.length === 0" class="scroller">
      <section class="file-item selectable-card-skeleton" v-for="i in 50" :key="i">
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
      </section>
    </div>
    <div class="scroller">
      <div class="file-items" v-for="(item, index) in items" :key="item.id">
        <section
          v-if="!item.name.startsWith('.') || fileShowHidden"
          class="file-item selectable-card"
          @dblclick.prevent="dbclickItem(item)"
          :class="{ selected: selectedIds.includes(item.id) || selectedItem?.id === item.id, selecting: shiftEffectingIds.includes(item.id) }"
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

          <div class="image">
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
            <span v-if="!item.isDir">{{ formatFileSize(item.size) }}</span>
            <span v-tooltip="formatDateTime(item.updatedAt)">{{ formatTimeAgo(item.updatedAt) }}</span>
          </div>
        </section>
      </div>
    </div>
    <div class="no-data-placeholder" v-if="!loading && items.length === 0">
      {{ $t(noDataKey(loading, app.permissions, 'WRITE_EXTERNAL_STORAGE')) }}
    </div>
    <input ref="fileInput" style="display: none" type="file" multiple @change="uploadChanged" />
    <input ref="dirFileInput" style="display: none" type="file" multiple webkitdirectory mozdirectory directory @change="dirUploadChanged" />
  </aside>

  <div class="content" v-if="selectedItem" :style="{ width: mainStore.sidebarFileInfoWidth + 'px' }">
    <div class="sidebar-drag-indicator" @mousedown="resizeWidth"></div>
    <div class="top-app-bar">
      <div class="title">
        <span>{{ selectedItem.name }}</span>
        <button class="btn-icon sm" @click.stop="downloadFile(selectedItem.path)" v-tooltip="$t('download')">
          <md-ripple />
          <i-material-symbols:download-rounded />
        </button>
        <button v-if="canOpenInBrowser(selectedItem.name) || canView(selectedItem.name)" class="btn-icon sm" @click.stop="viewItem(selectedItem)" v-tooltip="$t('view')">
          <md-ripple />
          <i-material-symbols:preview-outline />
        </button>
      </div>
    </div>
    <section class="card">
      <div class="key-value">
        <div class="key">{{ $t('path') }}</div>
        <div class="value">
          {{ selectedItem.path }}
        </div>
      </div>
      <div class="key-value" v-if="selectedItem.createdAt">
        <div class="key">{{ $t('created_at') }}</div>
        <div class="value">
          <span v-tooltip="formatDateTime(selectedItem.createdAt)">{{ formatTimeAgo(selectedItem.createdAt) }}</span>
        </div>
      </div>
      <div class="key-value">
        <div class="key">{{ $t('updated_at') }}</div>
        <div class="value">
          <span v-tooltip="formatDateTime(selectedItem.updatedAt)">{{ formatTimeAgo(selectedItem.updatedAt) }}</span>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { contextmenu } from '@/components/contextmenu'
import { computed, onActivated, onDeactivated, ref, watch } from 'vue'
import { formatDateTime, formatFileSize, formatTimeAgo } from '@/lib/format'
import { useI18n } from 'vue-i18n'
import { useMainStore } from '@/stores/main'
import { storeToRefs } from 'pinia'
import { type FilePanel, type IFile, isImage, isVideo, canOpenInBrowser, canView, getSortItems } from '@/lib/file'
import { getFileExtension, getFileId, getFileName, getFileUrl, getFileUrlByPath } from '@/lib/api/file'
import { noDataKey } from '@/lib/list'
import emitter from '@/plugins/eventbus'
import { useFiles, useCreateDir, useDeleteFiles, useRename, useStats, useDownload, useView, useSingleSelect, useCopyPaste, getRootDir } from '@/hooks/files'
import { useFileUpload } from '@/hooks/upload'
import { useTempStore, type IUploadItem } from '@/stores/temp'
import { openModal } from '@/components/modal'
import DeleteFileConfirm from '@/components/DeleteFileConfirm.vue'
import EditValueModal from '@/components/EditValueModal.vue'
import { useRoute } from 'vue-router'
import { decodeBase64, shortUUID } from '@/lib/strutil'
import { parseQuery } from '@/lib/search'
import { initMutation, setTempValueGQL } from '@/lib/api/mutation'
import type { ISource } from '@/components/lightbox/types'
import type { MdCheckbox } from '@material/web/checkbox/checkbox'
import type { IFileDeletedEvent } from '@/lib/interfaces'
import { useSelectable } from '@/hooks/list'
import { useRightSidebarResize } from '@/hooks/sidebar'
import { useFilesKeyEvents } from '@/hooks/key-events'
import { filesGQL, initLazyQuery } from '@/lib/api/query'
import toast from '@/components/toaster'

const { t } = useI18n()
const sources = ref([])

const route = useRoute()
const query = route.query
const filesType = route.params['type'] as string
const q = ref(decodeBase64(query.q?.toString() ?? ''))
const fields = parseQuery(q.value as string)
const initPath = ref(fields.find((it) => it.name === 'path')?.value ?? '')

const items = ref<IFile[]>([])
const selectedItem = ref<IFile | null>(null)
const { selectedIds, allChecked, realAllChecked, clearSelection, toggleAllChecked, toggleSelect, total, checked, shiftEffectingIds, handleItemClick, handleMouseOver, selectAll, shouldSelect } =
  useSelectable(items)
const { keyDown: pageKeyDown, keyUp: pageKeyUp } = useFilesKeyEvents(total, selectAll, clearSelection, () => {})

const imageErrorIds = ref<string[]>([])
const extensionImageErrorIds = ref<string[]>([])
const onImageError = (id: string) => {
  imageErrorIds.value.push(id)
}
const onExtensionImageError = (id: string) => {
  extensionImageErrorIds.value.push(id)
}

const clickItem = (item: IFile) => {
  selectedItem.value = item
}

const { resizeWidth } = useRightSidebarResize(
  300,
  () => {
    return mainStore.sidebarFileInfoWidth
  },
  (width: number) => {
    mainStore.sidebarFileInfoWidth = width
  }
)

let dirTmp = fields.find((it) => it.name === 'dir')?.value ?? ''
if (!dirTmp) {
  const isDir = fields.find((it) => it.name === 'isDir')?.value === '1'
  if (isDir) {
    dirTmp = initPath.value
  } else {
    dirTmp = initPath.value.substring(0, initPath.value.lastIndexOf('/'))
  }
}

const sortItems = getSortItems()

const mainStore = useMainStore()
const { fileShowHidden, fileSortBy } = storeToRefs(mainStore)

const tempStore = useTempStore()
const { app, urlTokenKey, selectedFiles, uploads } = storeToRefs(tempStore)
let rootDir = getRootDir(filesType, app.value)
const currentDir = ref(dirTmp || rootDir)
const panels = ref<FilePanel[]>([])
const { createPath, createVariables, createMutation } = useCreateDir(urlTokenKey, panels)
const { renameValue, renamePath, renameDone, renameMutation, renameVariables } = useRename(panels)
const { internal, sdcard, usb, refetch: refetchStats } = useStats()
const { onDeleted } = useDeleteFiles(panels, currentDir, refetchStats)
const { downloadFile, downloadDir, downloadFiles } = useDownload(urlTokenKey)
const { view } = useView(sources, (s: ISource[], index: number) => {
  tempStore.lightbox = {
    sources: s,
    index: index,
    visible: true,
  }
})

interface IBreadcrumbItem {
  path: string
  name: string
}

const breadcrumbPaths = computed(() => {
  const paths: IBreadcrumbItem[] = []
  let p = currentDir.value
  while (p) {
    if (p === rootDir) {
      break
    }
    paths.unshift({ path: p, name: getFileName(p) })
    p = p.substring(0, p.lastIndexOf('/'))
  }
  paths.unshift({ path: rootDir, name: getPageTitle() })

  return paths
})

const { loading, fetch } = initLazyQuery({
  handle: async (data: any, error: string) => {
    if (error) {
      toast(t(error), 'error')
    } else {
      const r = data.files
      const list: IFile[] = []
      for (const item of r.items) {
        list.push({ ...item, id: item.path, name: getFileName(item.path), fileId: getFileId(urlTokenKey.value, item.path), extension: getFileExtension(item.path) })
      }
      items.value = list
    }
  },
  document: filesGQL,
  variables: () => ({
    dir: currentDir.value,
    showHidden: true,
    sortBy: fileSortBy.value,
  }),
  appApi: true,
})
const { canPaste, copy, cut, paste } = useCopyPaste(selectedFiles, fetch, refetchStats)
const { input: fileInput, upload: uploadFiles, uploadChanged } = useFileUpload(uploads)
const { input: dirFileInput, upload: uploadDir, uploadChanged: dirUploadChanged } = useFileUpload(uploads)

const { mutate: setTempValue, onDone: setTempValueDone } = initMutation({
  document: setTempValueGQL,
  appApi: true,
})

setTempValueDone((r: any) => {
  downloadFiles(r.data.setTempValue.key)
  clearSelection()
})

function toggleShowHiddenChecked(e: Event) {
  fileShowHidden.value = (e.target as MdCheckbox).checked
}

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

const deleteItems = () => {
  openModal(DeleteFileConfirm, {
    files: JSON.stringify(
      selectedIds.value.map((it: string) => ({
        path: it,
      }))
    ),
    onDone: onDeleted,
  })
}

function getPageTitle() {
  if (filesType) {
    if (filesType === 'sdcard') {
      return `${t('sdcard')} (${t('storage_free_total', {
        free: formatFileSize(sdcard.value?.freeBytes ?? 0),
        total: formatFileSize(sdcard.value?.totalBytes ?? 0),
      })})`
    } else if (filesType === 'app') {
      return t('app_name')
    } else if (filesType.startsWith('usb')) {
      const num = parseInt(filesType.substring(3))
      const u = usb.value[num - 1]
      return `${t('usb_storage')} ${num} (${t('storage_free_total', {
        free: formatFileSize(u?.freeBytes ?? 0),
        total: formatFileSize(u?.totalBytes ?? 0),
      })})`
    }
  }

  return `${t('internal_storage')} (${formatFileSize(internal.value?.freeBytes ?? 0)} / ${formatFileSize(internal.value?.totalBytes ?? 0, true, 0)})`
}

function dbclickItem(item: IFile) {
  if (item.isDir) {
    currentDir.value = item.path
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

function viewItem(item: IFile) {
  if (canView(item.name)) {
    view(items.value, item)
  } else {
    window.open(getFileUrlByPath(urlTokenKey.value, item.path), '_blank')
  }
}

function sort(slotProps: { close: () => void }, sort: string) {
  // only sort the last column
  fileSortBy.value = sort
  slotProps.close()
}

function refreshCurrentDir() {
  fetch()
}

// function dbclickItem(panel: FilePanel, item: IFile) {
//   if (!item.isDir) {
//     if (canOpenInBrowser(item.name)) {
//       window.open(getFileUrlByPath(urlTokenKey.value, item.path), '_blank')
//     } else if (canView(item.name)) {
//       if (fileShowHidden) {
//         view(panel.items, item)
//       } else {
//         view(
//           panel.items.filter((it: IFile) => !it.name.startsWith('.')),
//           item
//         )
//       }
//     } else {
//       downloadFile(item.path)
//     }
//   }
// }

function emptyCtxMenu(e: MouseEvent, dir: string) {
  e.preventDefault()
  const items = [
    {
      label: t('create_folder'),
      onClick: () => {
        createPath.value = dir
        openModal(EditValueModal, {
          title: t('name'),
          placeholder: t('name'),
          mutation: createMutation,
          getVariables: createVariables,
        })
      },
    },
    {
      label: t('upload_files'),
      onClick: () => {
        uploadFiles(dir)
      },
    },
    {
      label: t('upload_folder'),
      onClick: () => {
        uploadDir(dir)
      },
    },
  ]
  if (canPaste()) {
    items.push({
      label: t('paste'),
      onClick: () => {
        paste(dir)
      },
    })
  }
  contextmenu({
    x: e.x,
    y: e.y,
    items,
  })
}

function itemCtxMenu(e: MouseEvent, panel: FilePanel, f: IFile) {
  e.preventDefault()
  let items
  if (f.isDir) {
    items = [
      {
        label: t('upload_files'),
        onClick: () => {
          uploadFiles(f.path)
        },
      },
      {
        label: t('upload_folder'),
        onClick: () => {
          uploadDir(f.path)
        },
      },
      {
        label: t('download'),
        onClick: () => {
          downloadDir(f.path)
        },
      },
    ]
  } else {
    items = []
    if (canOpenInBrowser(f.name) || canView(f.name)) {
      items.push({
        label: t('open'),
        onClick: () => {
          if (canView(f.name)) {
            view(panel.items, f)
          } else {
            window.open(getFileUrlByPath(urlTokenKey.value, f.path), '_blank')
          }
        },
      })
    }
    items.push({
      label: t('download'),
      onClick: () => {
        downloadFile(f.path)
      },
    })
  }
  items.push({
    label: t('duplicate'),
    onClick: () => {
      copy([f])
      paste(panel.dir)
    },
  })
  items.push({
    label: t('cut'),
    onClick: () => {
      f.panel = panel
      cut([f])
    },
  })
  items.push({
    label: t('copy'),
    onClick: () => {
      copy([f])
    },
  })

  if (f.isDir && canPaste()) {
    items.push({
      label: t('paste'),
      onClick: () => {
        paste(f.path)
      },
    })
  }

  items = [
    ...items,
    {
      label: t('rename'),
      onClick: () => {
        renameValue.value = f.name
        renamePath.value = f.path
        openModal(EditValueModal, {
          title: t('rename'),
          placeholder: t('name'),
          value: f.name,
          mutation: renameMutation,
          getVariables: renameVariables,
          done: renameDone,
        })
      },
    },
    {
      label: t('delete'),
      onClick: () => {
        openModal(DeleteFileConfirm, {
          files: [f],
          onDone: onDeleted,
        })
      },
    },
  ]

  contextmenu({
    x: e.x,
    y: e.y,
    items,
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

onActivated(() => {
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
.scroller {
  height: calc(100vh - 112px);
}
</style>
