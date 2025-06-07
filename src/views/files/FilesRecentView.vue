<template>
  <div class="top-app-bar">
    <v-checkbox touch-target="wrapper" :checked="allChecked" :indeterminate="!allChecked && checked" @change="toggleAllChecked" />
    <span v-if="selectedIds.length">{{ $t('x_selected', { count: realAllChecked ? total.toLocaleString() : selectedIds.length.toLocaleString() }) }}</span>
    <span v-else>{{ $t('recent_files') }} ({{ total.toLocaleString() }})</span>
    <template v-if="checked">
      <button v-tooltip="$t('download')" class="btn-icon" @click.stop="downloadItems">
        
        <i-material-symbols:download-rounded />
      </button>
    </template>
  </div>
  <div v-if="loading && items.length === 0" class="scroller">
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
  <VirtualList v-if="items.length > 0" class="scroller" :data-key="'id'" :data-sources="items" :estimate-size="80">
    <template #item="{ index, item }">
      <section
        :key="item.id"
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
          <button v-tooltip="$t('download')" class="btn-icon sm" @click.stop="downloadFile(item.path)">
            
            <i-material-symbols:download-rounded />
          </button>

          <popper>
            <button v-tooltip="$t('info')" class="btn-icon sm">
              <i-material-symbols:info-outline-rounded />
            </button>
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
        </div>
      </section>
    </template>
  </VirtualList>
  <div v-if="!loading && items.length === 0" class="no-data-placeholder">
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

import { useSelectable } from '@/hooks/list'
import { useFilesKeyEvents } from '@/hooks/key-events'
import { initLazyQuery, recentFilesGQL } from '@/lib/api/query'
import VirtualList from '@/components/virtualscroll'
import emitter from '@/plugins/eventbus'
import type { IFileDeletedEvent, IFileRenamedEvent } from '@/lib/interfaces'
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
const { keyDown: pageKeyDown, keyUp: pageKeyUp } = useFilesKeyEvents(selectAll, clearSelection, () => {})

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

const fileRenamedHandler = (event: IFileRenamedEvent) => {
  // Refresh recent files list to show new filename
  fetch()
}

onActivated(() => {
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
