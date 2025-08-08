<template>
  <div class="top-app-bar">
    <v-checkbox touch-target="wrapper" :checked="allChecked" :indeterminate="!allChecked && checked" @change="toggleAllChecked" />
    <span v-if="selectedIds.length">{{ $t('x_selected', { count: realAllChecked ? total.toLocaleString() : selectedIds.length.toLocaleString() }) }}</span>
    <span v-else>{{ $t('recent_files') }} ({{ total.toLocaleString() }})</span>
    <template v-if="checked">
      <v-icon-button v-tooltip="$t('download')" @click.stop="downloadItems">
        <i-material-symbols:download-rounded />
      </v-icon-button>
    </template>
  </div>
  <div v-if="loading && items.length === 0" class="scroller main-list">
    <FileRecentSkeletonItem v-for="i in 20" :key="i" :index="i" :is-phone="isPhone" />
  </div>
  <VirtualList v-if="items.length > 0" class="scroller main-list" :data-key="'id'" :data-sources="items" :estimate-size="isPhone ? 120 : 80">
    <template #item="{ index, item }">
      <FileRecentItem
        :key="item.id"
        :item="item"
        :index="index"
        :selected-ids="selectedIds"
        :shift-effecting-ids="shiftEffectingIds"
        :should-select="shouldSelect"
        :is-phone="isPhone"
        :image-error-ids="imageErrorIds"
        :extension-image-error-ids="extensionImageErrorIds"
        :handle-item-click="handleItemClick"
        :handle-mouse-over="handleMouseOver"
        :toggle-select="toggleSelect"
        :on-image-error="onImageError"
        :on-extension-image-error="onExtensionImageError"
        :download-file="downloadFile"
        :click-item="clickItem"
      />
    </template>
  </VirtualList>
  <div v-if="!loading && items.length === 0" class="no-data-placeholder">
    {{ $t(noDataKey(loading, app.permissions, 'WRITE_EXTERNAL_STORAGE')) }}
  </div>
</template>

<script setup lang="ts">
import toast from '@/components/toaster'
import { onActivated, onDeactivated, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { type IFile, canOpenInBrowser, canView, enrichFile } from '@/lib/file'
import { getFileUrlByPath } from '@/lib/api/file'
import { noDataKey } from '@/lib/list'
import { useDownload, useView } from '@/hooks/files'
import { openModal } from '@/components/modal'
import DownloadMethodModal from '@/components/DownloadMethodModal.vue'
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
import { getIsPhone } from '@/hooks/device'

const { t } = useI18n()
const sources = ref([])
const isPhone = getIsPhone()

const tempStore = useTempStore()
const { app, urlTokenKey } = storeToRefs(tempStore)
const items = ref<IFile[]>([])

const { selectedIds, allChecked, realAllChecked, clearSelection, toggleAllChecked, toggleSelect, total, checked, shiftEffectingIds, handleItemClick, handleMouseOver, selectAll, shouldSelect } =
  useSelectable(items)
const { downloadFile, downloadFiles, downloadDir } = useDownload(urlTokenKey)
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
  const selected = items.value.filter((it) => selectedIds.value.includes(it.id))
  if (selected.length === 0) {
    toast(t('select_first'), 'error')
    return
  }

  if (selected.length === 1 && !selected[0].isDir) {
    downloadFile(selected[0].path)
    clearSelection()
    return
  }

  openModal(DownloadMethodModal, {
    onEach: async () => {
      for (const it of selected) {
        if (it.isDir) {
          downloadDir(it.path)
        } else {
          downloadFile(it.path)
        }
        await new Promise((resolve) => setTimeout(resolve, 250))
      }
      clearSelection()
    },
    onZip: () => {
      setTempValue({
        key: shortUUID(),
        value: JSON.stringify(
          selectedIds.value.map((it: string) => ({
            path: it,
          }))
        ),
      })
    },
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
