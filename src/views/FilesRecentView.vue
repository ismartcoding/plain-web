<template>
  <div class="v-toolbar">
    <breadcrumb :current="$t('recent_files')" />
    <div class="right-actions">
      <template v-if="selectMode && checked">
        <button type="button" class="btn btn-action" @click.stop="downloadItems" :title="$t('download')">
          <i-material-symbols:download-rounded class="bi" />
        </button>
      </template>
      <div class="form-check mt-2 me-3 ms-3">
        <input class="form-check-input" v-model="selectMode" id="select-mode" type="checkbox" />
        <label class="form-check-label" for="select-mode">{{ $t('select_mode') }}</label>
      </div>
    </div>
  </div>
  <div class="panel-container">
    <div class="file-items" v-if="app.permissions.includes('WRITE_EXTERNAL_STORAGE')">
      <template v-for="f of files" :key="f.path">
        <div
          class="file-item"
          :class="{
            active: selectedItem?.path === f.path,
          }"
          @click="clickItem(f)"
          @dblclick="dbclickItem(f)"
          @contextmenu="itemCtxMenu($event, f)"
        >
          <input class="form-check-input" v-if="selectMode" v-model="f.checked" type="checkbox" />
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
    </div>
    <div class="no-data-placeholder" v-if="files.length === 0">
      {{ $t(noDataKey(loading, app.permissions, 'WRITE_EXTERNAL_STORAGE')) }}
    </div>
  </div>
  <div class="file-item-info" v-if="selectedItem">{{ $t('path') }}: {{ selectedItem.path }}</div>
  <lightbox :visible="ivVisible" :index="ivIndex" :sources="sources" @hide="ivHide" />
</template>

<script setup lang="ts">
import { contextmenu } from '@/components/contextmenu'
import { computed, ref } from 'vue'
import { formatDateTime, formatFileSize } from '@/lib/format'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { type IFile, isImage, isVideo, isAudio } from '@/lib/file'
import { getFileUrl } from '@/lib/api/file'
import { useMediaViewer } from '@/components/lightbox/use'
import { noDataKey } from '@/lib/list'
import { useDownload, useView, useRecentFiles } from './hooks/files'
import { useTempStore } from '@/stores/temp'
import { shortUUID } from '@/lib/strutil'
import { initMutation, setTempValueGQL } from '@/lib/api/mutation'
import toast from '@/components/toaster'

const { t } = useI18n()
const sources = ref([])

const selectMode = ref(false)
const { app } = storeToRefs(useTempStore())
const { loading, files } = useRecentFiles(app)

const { visible: ivVisible, index: ivIndex, view: ivView, hide: ivHide } = useMediaViewer()
const { downloadFile, downloadDir, downloadFiles } = useDownload(app)
const { view } = useView(sources, ivView)
const selectedItem = ref<IFile | null>(null)

const { mutate: setTempValue, onDone: setTempValueDone } = initMutation({
  document: setTempValueGQL,
  appApi: true,
})

setTempValueDone((r: any) => {
  downloadFiles(r.data.setTempValue.key)
})

const getSelectedFiles = () => {
  const items: any[] = []
  files.value.forEach((f: IFile) => {
    if (f.checked) {
      items.push({ path: f.path })
    }
  })
  return items
}

const downloadItems = () => {
  setTempValue({ key: shortUUID(), value: JSON.stringify(getSelectedFiles()) })
}

const checked = computed<boolean>(() => {
  return getSelectedFiles().length > 0
})

function clickItem(item: IFile) {
  if (selectMode.value) {
    item.checked = !item.checked
    return
  }
  selectedItem.value = item
}

function canView(item: IFile) {
  return isImage(item.name) || isVideo(item.name) || isAudio(item.name)
}

function dbclickItem(item: IFile) {
  if (canView(item)) {
    view(files.value, item)
  } else {
    downloadFile(item.path)
  }
}

function itemCtxMenu(e: MouseEvent, f: IFile) {
  e.preventDefault()
  let items
  if (f.isDir) {
    items = [
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
          view(files.value, f)
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

  contextmenu({
    x: e.x,
    y: e.y,
    items,
  })
}
</script>
<style lang="scss" scoped>
.file-item-info {
  padding-top: 8px;
}

.panel-container {
  height: calc(100vh - 180px);
  display: flex;
}

.no-data-placeholder {
  align-items: center;
  justify-content: center;
  display: flex;
  width: 100%;
}

.file-items {
  overflow: auto;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 6px 8px;
  flex: 1;

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
}
</style>
