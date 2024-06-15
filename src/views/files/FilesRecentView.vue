<template>
  <aside class="sidebar2">
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
    <VirtualList v-if="items.length > 0" class="scroller" :data-key="'id'" :data-sources="items" :estimate-size="80">
      <template #item="{ index, item }">
        <section
          class="file-item selectable-card"
          :key="item.id"
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
            <img v-if="extensionImageErrorIds.includes(item.id)" class="svg" src="/ficons/default.svg" />
            <img v-else-if="!imageErrorIds.includes(item.id) && item.fileId" class="image-thumb" :src="getFileUrl(item.fileId, '&w=50&h=50')" @error="onImageError(item.id)" />
            <img v-else-if="item.extension" :src="`/ficons/${item.extension}.svg`" class="svg" @error="onExtensionImageError(item.id)" />
            <img v-else class="svg" src="/ficons/default.svg" />
          </div>
          <div class="title">
            {{ item.name }}
          </div>
          <div class="subtitle">
            <span>{{ formatFileSize(item.size) }}</span>
            <span v-tooltip="formatDateTime(item.updatedAt)">{{ formatTimeAgo(item.updatedAt) }}</span>
          </div>
        </section>
      </template>
    </VirtualList>
    <div class="no-data-placeholder" v-if="!loading && items.length === 0">
      {{ $t(noDataKey(loading, app.permissions, 'WRITE_EXTERNAL_STORAGE')) }}
    </div>
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
import toast from '@/components/toaster'
import { onActivated, onDeactivated, ref } from 'vue'
import { formatDateTime, formatFileSize, formatTimeAgo } from '@/lib/format'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { type IFile, isImage, isVideo, canOpenInBrowser, canView } from '@/lib/file'
import { getFileId, getFileName, getFileUrl, getFileUrlByPath, getFileExtension } from '@/lib/api/file'
import { noDataKey } from '@/lib/list'
import { useDownload, useView } from '@/hooks/files'
import { useTempStore } from '@/stores/temp'
import { useMainStore } from '@/stores/main'
import { shortUUID } from '@/lib/strutil'
import { initMutation, setTempValueGQL } from '@/lib/api/mutation'
import type { ISource } from '@/components/lightbox/types'
import type { MdCheckbox } from '@material/web/checkbox/checkbox'
import { useSelectable } from '@/hooks/list'
import { useFilesKeyEvents } from '@/hooks/key-events'
import { initLazyQuery, recentFilesGQL } from '@/lib/api/query'
import { useRightSidebarResize } from '@/hooks/sidebar'
import VirtualList from '@/components/virtualscroll'

const mainStore = useMainStore()
const { t } = useI18n()
const sources = ref([])

const tempStore = useTempStore()
const { app, urlTokenKey } = storeToRefs(tempStore)
const items = ref<IFile[]>([])
const selectedItem = ref<IFile | null>(null)

const { selectedIds, allChecked, realAllChecked, clearSelection, toggleAllChecked, toggleSelect, total, checked, shiftEffectingIds, handleItemClick, handleMouseOver, selectAll, shouldSelect } = useSelectable(items)
const { downloadFile, downloadFiles } = useDownload(urlTokenKey)
const { view } = useView(sources, (s: ISource[], index: number) => {
  tempStore.lightbox = {
    sources: s,
    index: index,
    visible: true,
  }
})
const { keyDown: pageKeyDown, keyUp: pageKeyUp } = useFilesKeyEvents(total, selectAll, clearSelection, () => {})

const imageErrorIds = ref<string[]>([])
const extensionImageErrorIds = ref<string[]>([])
const onImageError = (id: string) => {
  imageErrorIds.value.push(id)
}
const onExtensionImageError = (id: string) => {
  extensionImageErrorIds.value.push(id)
}

const { mutate: setTempValue, onDone: setTempValueDone } = initMutation({
  document: setTempValueGQL,
  appApi: true,
})

setTempValueDone((r: any) => {
  downloadFiles(r.data.setTempValue.key)
  clearSelection()
})

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

const { loading, fetch } = initLazyQuery({
  handle: async (data: any, error: string) => {
    if (error) {
      toast(t(error), 'error')
    } else {
      const files = []
      for (const item of data.recentFiles) {
        const tmp = { ...item, id: item.path, name: getFileName(item.path), extension: getFileExtension(item.path) }
        if (isVideo(tmp.name) || isImage(tmp.name)) {
          tmp.fileId = getFileId(urlTokenKey.value, item.path, item.mediaId)
        }
        files.push(tmp)
      }
      items.value = files
      total.value = files.length
    }
  },
  document: recentFilesGQL,
  appApi: true,
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

function dbclickItem(item: IFile) {
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
