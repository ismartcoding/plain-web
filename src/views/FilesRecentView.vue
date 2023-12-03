<template>
  <div class="v-toolbar">
    <breadcrumb :current="$t('recent_files')" />
    <div class="right-actions">
      <template v-if="selectMode && checked">
        <button class="icon-button" @click.stop="downloadItems" v-tooltip="$t('download')">
          <md-ripple />
          <i-material-symbols:download-rounded />
        </button>
      </template>
      <label class="form-check-label">
        <md-checkbox touch-target="wrapper" @change="toggleSelectModeChecked" :checked="selectMode" />{{
          $t('select_mode')
        }}
      </label>
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
          @dblclick.prevent="dbclickItem(f)"
          @contextmenu="itemCtxMenu($event, f)"
        >
          <md-checkbox touch-target="wrapper" v-if="selectMode" :checked="f.checked" />
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
</template>

<script setup lang="ts">
import { contextmenu } from '@/components/contextmenu'
import { computed, ref } from 'vue'
import { formatDateTime, formatFileSize } from '@/lib/format'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { type IFile, isImage, isVideo, canOpenInBrowser, canView } from '@/lib/file'
import { getFileUrl, getFileUrlByPath } from '@/lib/api/file'
import { noDataKey } from '@/lib/list'
import { useDownload, useView, useRecentFiles } from './hooks/files'
import { useTempStore } from '@/stores/temp'
import { shortUUID } from '@/lib/strutil'
import { initMutation, setTempValueGQL } from '@/lib/api/mutation'
import type { ISource } from '@/components/lightbox/types'
import type { MdCheckbox } from '@material/web/checkbox/checkbox'

const { t } = useI18n()
const sources = ref([])

const selectMode = ref(false)
const tempStore = useTempStore()
const { app, urlTokenKey } = storeToRefs(tempStore)
const { loading, files } = useRecentFiles(urlTokenKey)

const { downloadFile, downloadDir, downloadFiles } = useDownload(urlTokenKey)
const { view } = useView(sources, (s: ISource[], index: number) => {
  tempStore.lightbox = {
    sources: s,
    index: index,
    visible: true,
  }
})
const selectedItem = ref<IFile | null>(null)

const { mutate: setTempValue, onDone: setTempValueDone } = initMutation({
  document: setTempValueGQL,
  appApi: true,
})

setTempValueDone((r: any) => {
  downloadFiles(r.data.setTempValue.key)
  files.value.forEach((f: IFile) => {
    f.checked = false
  })
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

function toggleSelectModeChecked(e: Event) {
  selectMode.value = (e.target as MdCheckbox).checked
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

function dbclickItem(item: IFile) {
  if (canOpenInBrowser(item.name)) {
    window.open(getFileUrlByPath(urlTokenKey.value, item.path), '_blank')
  } else if (canView(item.name)) {
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
    if (canOpenInBrowser(f.name) || canView(f.name)) {
      items.push({
        label: t('open'),
        onClick: () => {
          if (canView(f.name)) {
            view(files.value, f)
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
  height: calc(100vh - 200px);
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
  flex: 1;

  .file-item {
    padding: 8px;
    word-break: break-all;
    border: 1px solid transparent;
    display: flex;
    align-items: center;
    user-select: none;

    &:hover {
      cursor: pointer;
    }

    svg,
    img {
      margin-right: 8px;
    }

    &:hover, &.active {
      background-color: var(--md-sys-color-on-surface-selected);
      border-radius: 8px;
    }
  }
}
</style>
