<template>
  <div class="v-toolbar">
    <breadcrumb :current="getPageTitle" />
    <div class="right-actions">
      <template v-if="selectMode && checked">
        <button type="button" class="btn btn-action" @click.stop="() => copy(getSelectedFiles())">
          {{ $t('copy') }}
        </button>
        <button type="button" class="btn btn-action" @click.stop="() => cut(getSelectedFiles())">
          {{ $t('cut') }}
        </button>
        <button type="button" class="btn btn-action" @click.stop="deleteItems" :title="$t('delete')">
          <i-material-symbols:delete-outline-rounded class="bi" />
        </button>
        <button type="button" class="btn btn-action" @click.stop="downloadItems" :title="$t('download')">
          <i-material-symbols:download-rounded class="bi" />
        </button>
      </template>
      <div class="form-check mt-2 me-3 ms-3">
        <input class="form-check-input" v-model="selectMode" id="select-mode" type="checkbox" />
        <label class="form-check-label" for="select-mode">{{ $t('select_mode') }}</label>
      </div>
      <div class="form-check mt-2">
        <input class="form-check-input" v-model="fileShowHidden" id="show-hidden" type="checkbox" />
        <label class="form-check-label" for="show-hidden">{{ $t('show_hidden') }}</label>
      </div>
    </div>
  </div>
  <splitpanes class="panel-container">
    <pane v-for="panel in panels" :key="panel.dir">
      <div class="file-items">
        <template v-for="f of panel.items" :key="f.path">
          <div
            class="file-item"
            v-if="!f.name.startsWith('.') || fileShowHidden"
            :class="{
              active: (currentDir + '/').startsWith(f.path + '/') || selectedItem?.path === f.path,
            }"
            @click="clickItem(panel, f)"
            @dblclick="dbclickItem(panel, f)"
            @contextmenu="itemCtxMenu($event, panel, f)"
          >
            <input class="form-check-input" v-if="selectMode" v-model="f.checked" type="checkbox" />
            <i-material-symbols:folder-outline-rounded class="bi" v-if="f.isDir" />
            <img
              v-if="isImage(f.name) || isVideo(f.name)"
              :src="getFileUrl(f.fileId) + '&w=50&h=50'"
              width="50"
              height="50"
            />
            <div class="title">
              {{ f.name }}
              <div style="font-size: 0.75rem">
                {{ formatDateTime(f.updatedAt) }}<template v-if="!f.isDir">, {{ formatFileSize(f.size) }}</template>
              </div>
            </div>
          </div>
        </template>
        <div class="empty" @contextmenu="emptyCtxMenu($event, panel.dir)">
          <div
            class="no-files"
            v-if="panel.items.filter((it) => !it.name.startsWith('.') || fileShowHidden).length === 0"
          >
            {{ $t('no_files') }}
          </div>
        </div>
      </div>
    </pane>
    <pane class="no-data-placeholder" v-if="panels.length === 0">
      {{ $t(noDataKey(loading, app.permissions, 'WRITE_EXTERNAL_STORAGE')) }}
    </pane>
  </splitpanes>
  <div class="file-item-info" v-if="selectedItem">{{ $t('path') }}: {{ selectedItem.path }}</div>
  <input ref="fileInput" style="display: none" type="file" multiple @change="uploadChanged" />
  <input
    ref="dirFileInput"
    style="display: none"
    type="file"
    multiple
    webkitdirectory
    mozdirectory
    directory
    @change="dirUploadChanged"
  />
</template>

<script setup lang="ts">
import { contextmenu } from '@/components/contextmenu'
import { computed, onMounted, ref, watch } from 'vue'
import { formatDateTime, formatFileSize } from '@/lib/format'
import { useI18n } from 'vue-i18n'
import { Splitpanes, Pane } from 'splitpanes'
import { useMainStore } from '@/stores/main'
import { storeToRefs } from 'pinia'
import { type FilePanel, type IFile, isImage, isVideo, isAudio } from '@/lib/file'
import { getFileUrl } from '@/lib/api/file'
import { noDataKey } from '@/lib/list'
import emitter from '@/plugins/eventbus'
import {
  useFiles,
  useCreateDir,
  useDelete,
  useRename,
  useStats,
  useDownload,
  useView,
  useFileUpload,
  useSingleSelect,
  useCopyPaste,
} from './hooks/files'
import { useTempStore, type IUploadItem } from '@/stores/temp'
import { openModal } from '@/components/modal'
import DeleteFileConfirm from '@/components/DeleteFileConfirm.vue'
import EditValueModal from '@/components/EditValueModal.vue'
import { useRoute } from 'vue-router'
import { decodeBase64, shortUUID } from '@/lib/strutil'
import { parseQuery } from '@/lib/search'
import { initMutation, setTempValueGQL } from '@/lib/api/mutation'
import type { ISource } from '@/components/lightbox/types'

const { t } = useI18n()
const sources = ref([])

const route = useRoute()
const query = route.query
const filesType = route.params['type'] as string
const q = ref(decodeBase64(query.q?.toString() ?? ''))
const fields = parseQuery(q.value as string)
const initPath = ref(fields.find((it) => it.name === 'path')?.value ?? '')

let dirTmp = fields.find((it) => it.name === 'dir')?.value ?? ''
if (!dirTmp) {
  const isDir = fields.find((it) => it.name === 'isDir')?.value === '1'
  if (isDir) {
    dirTmp = initPath.value
  } else {
    dirTmp = initPath.value.substring(0, initPath.value.lastIndexOf('/'))
  }
}
const initDir = ref(dirTmp)

const selectMode = ref(false)
const mainStore = useMainStore()

const tempStore = useTempStore()
const { app, selectedFiles } = storeToRefs(tempStore)
let rootDir = app.value.internalStoragePath
if (filesType) {
  if (filesType === 'sdcard') {
    rootDir = app.value.sdcardPath
  } else if (filesType.startsWith('usb')) {
    rootDir = app.value.usbDiskPaths[parseInt(filesType.substring(3)) - 1]
  } else if (filesType === 'app') {
    rootDir = app.value.externalFilesDir
  }
}
const { loading, panels, currentDir, refetch: refetchFiles } = useFiles(app, rootDir, initDir.value)

const { createPath, createVariables, createMutation } = useCreateDir(app, panels)
const { renameValue, renamePath, renameDone, renameMutation, renameVariables } = useRename(panels)
const { internal, sdcard, usb, refetch: refetchStats } = useStats()
const { onDeleted } = useDelete(panels, currentDir, refetchStats)
const { downloadFile, downloadDir, downloadFiles } = useDownload(app)
const { view } = useView(sources, (s: ISource[], index: number) => {
  tempStore.lightbox = {
      sources: s,
      index: index,
      visible: true
    }
})
const { selectedItem, select } = useSingleSelect(currentDir, filesType, q, mainStore)
const { canPaste, copy, cut, paste } = useCopyPaste(selectedFiles, refetchFiles, refetchStats)
const { input: fileInput, upload: uploadFiles, uploadChanged } = useFileUpload()
const { input: dirFileInput, upload: uploadDir, uploadChanged: dirUploadChanged } = useFileUpload()

const { mutate: setTempValue, onDone: setTempValueDone } = initMutation({
  document: setTempValueGQL,
  appApi: true,
})

setTempValueDone((r: any) => {
  downloadFiles(r.data.setTempValue.key)
})

const getSelectedFiles = () => {
  const files: IFile[] = []
  panels.value.forEach((p: FilePanel) => {
    p.items.forEach((f: IFile) => {
      if (f.checked) {
        f.panel = p
        files.push(f)
      }
    })
  })
  return files
}

const downloadItems = () => {
  setTempValue({ key: shortUUID(), value: JSON.stringify(getSelectedFiles().map((it) => ({ path: it.path }))) })
}

const checked = computed<boolean>(() => {
  return getSelectedFiles().length > 0
})

const deleteItems = () => {
  openModal(DeleteFileConfirm, {
    files: getSelectedFiles(),
    onDone: onDeleted,
  })
}
const { fileShowHidden } = storeToRefs(mainStore)

if (initPath.value) {
  watch(
    () => panels.value.length,
    () => {
      if (panels.value.length > 0 && initPath.value) {
        const panel = panels.value[panels.value.length - 1]
        const item = panel.items.find((it) => it.path === initPath.value)
        if (item) {
          selectedItem.value = item // set the selected item when page is refreshed
          initPath.value = ''
        }
      }
    }
  )
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

  return `${t('page_title.files')} (${t('storage_free_total', {
    free: formatFileSize(internal.value?.freeBytes ?? 0),
    total: formatFileSize(internal.value?.totalBytes ?? 0),
  })})`
}

function clickItem(panel: FilePanel, item: IFile) {
  if (selectMode.value) {
    item.checked = !item.checked
    return
  }
  select(panel, item)
}

function canView(item: IFile) {
  return isImage(item.name) || isVideo(item.name) || isAudio(item.name)
}

function dbclickItem(panel: FilePanel, item: IFile) {
  if (!item.isDir) {
    if (canView(item)) {
      if (fileShowHidden) {
        view(panel.items, item)
      } else {
        view(panel.items.filter((it: IFile) => !it.name.startsWith('.')), item)
      }
    } else {
      downloadFile(item.path)
    }
  }
}

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
    if (canView(f)) {
      items.push({
        label: t('open'),
        onClick: () => {
          view(panel.items, f)
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

onMounted(() => {
  emitter.on('upload_task_done', (r: IUploadItem) => {
    if (r.status === 'done') {
      // have to delay 1s to make sure the api return latest data.
      setTimeout(() => {
        refetchFiles(r.dir)
        refetchStats()
      }, 1000)
    }
  })
})
</script>
<style lang="scss" scoped>
.file-item-info {
  padding-top: 8px;
}

.panel-container {
  height: calc(100vh - 180px);
}

.no-data-placeholder {
  align-items: center;
  justify-content: center;
  display: flex;
}

.file-items {
  overflow: auto;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 6px 8px;

  .file-item {
    padding: 8px;
    word-break: break-all;
    border: 1px solid transparent;
    display: flex;
    align-items: center;

    &:hover {
      cursor: pointer;
    }

    svg,
    img {
      margin-right: 8px;
    }

    .form-check-input {
      margin-right: 8px;
    }

    &.active {
      border-radius: var(--border-radius-sm);
      border-color: var(--border-color);
    }
  }

  .empty {
    display: flex;
    min-height: 64px;
    flex-grow: 1;

    .no-files {
      display: flex;
      justify-content: center;
      align-items: center;
      width: 100%;
    }

    &:hover {
      cursor: default;
    }
  }
}
</style>
