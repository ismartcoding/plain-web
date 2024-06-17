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
  <div v-if="loading && items.length === 0" class="scroller">
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
  <VirtualList v-if="items.length > 0" class="scroller" :data-key="'id'" :data-sources="items" :estimate-size="80">
    <template #item="{ index, item }">
      <section
        class="file-item selectable-card"
        :key="item.id"
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
        <div class="image" @click.stop="clickItem(item)">
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
        <div class="actions">
          <button class="btn-icon sm" @click.stop="downloadFile(item.path)" v-tooltip="$t('download')">
            <md-ripple />
            <i-material-symbols:download-rounded />
          </button>

          <popper>
            <button class="btn-icon sm" v-tooltip="$t('info')">
              <md-ripple />
              <i-material-symbols:info-outline-rounded />
            </button>
            <template #content="slotProps">
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
        </div>
      </section>
    </template>
  </VirtualList>
  <div class="no-data-placeholder" v-if="!loading && items.length === 0">
    {{ $t(noDataKey(loading, app.permissions, 'WRITE_EXTERNAL_STORAGE')) }}
  </div>
</template>

<script setup lang="ts">
import toast from '@/components/toaster'
import { onActivated, onDeactivated, ref } from 'vue'
import { formatDateTime, formatFileSize, formatTimeAgo } from '@/lib/format'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { type IFile, isImage, isVideo, canOpenInBrowser, canView, enrichFile } from '@/lib/file'
import { getFileUrl, getFileUrlByPath } from '@/lib/api/file'
import { noDataKey } from '@/lib/list'
import { useDownload, useView } from '@/hooks/files'
import { useTempStore, type IUploadItem } from '@/stores/temp'
import { shortUUID } from '@/lib/strutil'
import { initMutation, setTempValueGQL } from '@/lib/api/mutation'
import type { ISource } from '@/components/lightbox/types'
import type { MdCheckbox } from '@material/web/checkbox/checkbox'
import { useSelectable } from '@/hooks/list'
import { useFilesKeyEvents } from '@/hooks/key-events'
import { initLazyQuery, recentFilesGQL } from '@/lib/api/query'
import VirtualList from '@/components/virtualscroll'
import emitter from '@/plugins/eventbus'
import type { IFileDeletedEvent } from '@/lib/interfaces'
import { remove } from 'lodash-es'

const { t } = useI18n()
const sources = ref([])

const tempStore = useTempStore()
const { app, urlTokenKey } = storeToRefs(tempStore)
const items = ref<IFile[]>([])

const { selectedIds, allChecked, realAllChecked, clearSelection, toggleAllChecked, toggleSelect, total, checked, shiftEffectingIds, handleItemClick, handleMouseOver, selectAll, shouldSelect } =
  useSelectable(items)
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
  if (canOpenInBrowser(item.name)) {
    window.open(getFileUrlByPath(urlTokenKey.value, item.path), '_blank')
  } else if (canView(item.name)) {
    view(items.value, item)
  } else {
    downloadFile(item.path)
  }
}

const { loading, fetch } = initLazyQuery({
  handle: async (data: any, error: string) => {
    if (error) {
      toast(t(error), 'error')
    } else {
      const files = []
      for (const item of data.recentFiles) {
        files.push(enrichFile(item, urlTokenKey.value))
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

const uploadTaskDoneHandler = (r: IUploadItem) => {
  if (r.status === 'done') {
    // have to delay 1s to make sure the api return latest data.
    setTimeout(() => {
      fetch()
    }, 1000)
  }
}

const onDeleted = (files: IFile[]) => {
  files.forEach((f) => {
    remove(items.value, (it: IFile) => it.id === f.id)
  })
  clearSelection()
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
