<template>
  <div class="top-app-bar">
    <md-checkbox touch-target="wrapper" @change="toggleAllChecked" :checked="allChecked" :indeterminate="!allChecked && checked" />
    <span v-if="selectedIds.length">{{ $t('x_selected', { count: realAllChecked ? total.toLocaleString() : selectedIds.length.toLocaleString() }) }}</span>
    <span v-else>{{ $t('recent_files') }} ({{ total.toLocaleString() }})</span>
    <template v-if="checked">
      <button class="btn-icon" @click.stop="downloadItems" v-tooltip="$t('download')">
        <md-ripple />
        <i-material-symbols:download-rounded />
      </button>
    </template>
  </div>
  <div class="scroll-content">
    <div class="file-items" :class="{ 'select-mode': checked }">
      <section
        class="file-item selectable-card"
        v-for="(item, i) in items"
        :key="item.id"
        @dblclick.prevent="dbclickItem(item)"
        :class="{ selected: selectedIds.includes(item.id), selecting: shiftEffectingIds.includes(item.id) }"
        @click.stop="
          handleItemClick($event, item, i, () => {
          })
        "
        @mouseover="handleMouseOver($event, i)"
      >
        <div class="start">
          <md-checkbox v-if="shiftEffectingIds.includes(item.id)" class="checkbox" touch-target="wrapper" @click.stop="toggleSelect($event, item, i)" :checked="shouldSelect" />
          <md-checkbox v-else class="checkbox" touch-target="wrapper" @click.stop="toggleSelect($event, item, i)" :checked="selectedIds.includes(item.id)" />
          <span class="number"><field-id :id="i + 1" :raw="item" /></span>
        </div>
        <i-material-symbols:library-music-outline-rounded v-if="imageErrorIds.includes(item.id)" class="image" />
        <img v-else-if="item.fileId" class="image" :src="getFileUrl(item.fileId, '&w=50&h=50')" @error="onImageError(item.id)" />
        <div class="title">
          {{ item.name }}
        </div>
        <div class="subtitle">
          {{ formatDateTime(item.updatedAt) }}<template v-if="!item.isDir">, {{ formatFileSize(item.size) }}</template>
        </div>
        <div class="actions"></div>
      </section>
    </div>
    <div class="no-data-placeholder" v-if="!loading && items.length === 0">
      {{ $t(noDataKey(loading, app.permissions, 'WRITE_EXTERNAL_STORAGE')) }}
    </div>
  </div>
  <div class="file-item-info" v-if="selectedItem">{{ $t('path') }}: {{ selectedItem.path }}</div>
</template>

<script setup lang="ts">
import { contextmenu } from '@/components/contextmenu'
import toast from '@/components/toaster'
import { onActivated, onDeactivated, ref } from 'vue'
import { formatDateTime, formatFileSize } from '@/lib/format'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { type IFile, isImage, isVideo, canOpenInBrowser, canView } from '@/lib/file'
import { getFileId, getFileName, getFileUrl, getFileUrlByPath } from '@/lib/api/file'
import { noDataKey } from '@/lib/list'
import { useDownload, useView } from '@/hooks/files'
import { useTempStore } from '@/stores/temp'
import { shortUUID } from '@/lib/strutil'
import { initMutation, setTempValueGQL } from '@/lib/api/mutation'
import type { ISource } from '@/components/lightbox/types'
import type { MdCheckbox } from '@material/web/checkbox/checkbox'
import { useSelectable } from '@/hooks/list'
import { useFilesKeyEvents } from '@/hooks/key-events'
import { initLazyQuery, recentFilesGQL } from '@/lib/api/query'

const { t } = useI18n()
const sources = ref([])

const tempStore = useTempStore()
const { app, urlTokenKey } = storeToRefs(tempStore)
const items = ref<IFile[]>([])

const {
  selectedIds,
  allChecked,
  realAllChecked,
  selectRealAll,
  allCheckedAlertVisible,
  clearSelection,
  toggleAllChecked,
  toggleSelect,
  total,
  checked,
  shiftEffectingIds,
  handleItemClick,
  handleMouseOver,
  selectAll,
  shouldSelect,
} = useSelectable(items)
const { downloadFile, downloadDir, downloadFiles } = useDownload(urlTokenKey)
const { view } = useView(sources, (s: ISource[], index: number) => {
  tempStore.lightbox = {
    sources: s,
    index: index,
    visible: true,
  }
})
const selectedItem = ref<IFile | null>(null)
const { keyDown: pageKeyDown, keyUp: pageKeyUp } = useFilesKeyEvents(total, selectAll, clearSelection, () => {})

const imageErrorIds = ref<string[]>([])
const onImageError = (id: string) => {
  imageErrorIds.value.push(id)
}

const { mutate: setTempValue, onDone: setTempValueDone } = initMutation({
  document: setTempValueGQL,
  appApi: true,
})

setTempValueDone((r: any) => {
  downloadFiles(r.data.setTempValue.key)
  clearSelection()
})

const { loading, fetch } = initLazyQuery({
  handle: async (data: any, error: string) => {
    if (error) {
      toast(t(error), 'error')
    } else {
      const files = data.recentFiles
      for (const item of files) {
        const tmp = { ...item, id: item.path, name: getFileName(item.path) }
        if (isVideo(tmp.name) || isImage(tmp.name)) {
          tmp.fileId = getFileId(urlTokenKey.value, item.path)
        }
        items.value.push(tmp)
      }
      total.value = files.length
    }
  },
  document: recentFilesGQL,
  appApi: true,
})

const downloadItems = () => {
  setTempValue({ key: shortUUID(), value: JSON.stringify(selectedIds.value) })
}

function dbclickItem(item: IFile) {
  if (canOpenInBrowser(item.name)) {
    window.open(getFileUrlByPath(urlTokenKey.value, item.path), '_blank')
  } else if (canView(item.name)) {
    view(items.value, item)
  } else {
    downloadFile(item.path)
  }
}

function itemCtxMenu(e: MouseEvent, f: IFile) {
  e.preventDefault()
  let items2
  if (f.isDir) {
    items2 = [
      {
        label: t('download'),
        onClick: () => {
          downloadDir(f.path)
        },
      },
    ]
  } else {
    items2 = []
    if (canOpenInBrowser(f.name) || canView(f.name)) {
      items2.push({
        label: t('open'),
        onClick: () => {
          if (canView(f.name)) {
            view(items.value, f)
          } else {
            window.open(getFileUrlByPath(urlTokenKey.value, f.path), '_blank')
          }
        },
      })
    }
    items2.push({
      label: t('download'),
      onClick: () => {
        downloadFile(f.path)
      },
    })
  }

  contextmenu({
    x: e.x,
    y: e.y,
    items: items2,
  })
}

onActivated(() => {
  fetch()
  window.addEventListener('keydown', pageKeyDown)
  window.addEventListener('keyup', pageKeyUp)
})

onDeactivated(() => {
  window.removeEventListener('keydown', pageKeyDown)
  window.removeEventListener('keyup', pageKeyUp)
})
</script>
<style lang="scss" scoped>
.file-item {
  display: grid;
  border-radius: 8px;
  grid-template-areas:
    'start image title actions'
    'start image subtitle  actions';
  grid-template-columns: 48px 50px 2fr 210px;
  &:hover {
    cursor: pointer;
  }
  .start {
    grid-area: start;
  }
  .number {
    font-size: 0.75rem;
    display: flex;
    justify-content: center;
  }
  .image {
    width: 50px;
    height: 50px;
    grid-area: image;
    object-fit: cover;
    border-radius: 8px;
    margin-block: 12px;
  }
  .title {
    grid-area: title;
    font-weight: 500;
    margin-inline: 16px;
    padding-block-start: 12px;
    word-break: break-all;
  }
  .subtitle {
    grid-area: subtitle;
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    font-size: 0.875rem;
    margin-inline: 16px;
    margin-block-start: 8px;
    margin-block-end: 12px;
  }
  .actions {
    grid-area: actions;
    display: flex;
    flex-direction: row;
    gap: 4px;
    align-items: center;
    visibility: visible;
    padding-inline: 16px;
  }
}

.file-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.file-items.select-mode {
  .file-item {
    .actions {
      visibility: hidden;
    }
  }
}

.no-data-placeholder {
  align-items: center;
  justify-content: center;
  display: flex;
  width: 100%;
}
</style>
