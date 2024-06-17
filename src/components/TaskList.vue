<template>
  <div class="quick-content-main">
    <div class="top-app-bar">
      <button class="btn-icon" @click.prevent="store.quick = ''" v-tooltip="$t('close')">
        <md-ripple />
        <i-material-symbols:right-panel-close-outline />
      </button>
      <div class="title">{{ $t('header_actions.tasks') }} ({{ tempStore.uploads.length }})</div>
      <div class="actions">
        <md-outlined-segmented-button-set class="sm">
          <md-outlined-segmented-button v-for="type in types" no-checkmark :key="type" :data-value="type" :label="getLabel(type)" :selected="filterType === type" @click="chooseFilterType(type)" />
        </md-outlined-segmented-button-set>
      </div>
    </div>
    <div class="quick-content-body">
      <VirtualList ref="listItemsRef" class="list-items" :data-key="'id'" :data-sources="visibleTasks" :estimate-size="64">
        <template #item="{ item }">
          <section class="item">
            <div class="title">{{ item.file.name }}</div>
            <div class="subtitle">
              [{{ $t(`upload_status.${item.status}`) }}] <template v-if="!['created', 'done'].includes(item.status)">{{ formatFileSize(item.uploadedSize) }}({{ item.uploadedSize }}) / </template
              >{{ formatFileSize(item.file.size) }}
            </div>
            <div class="body" v-if="item.error">{{ item.error }}</div>
            <button class="btn-icon icon" @click.stop="deleteItem(item)">
              <md-ripple />
              <i-material-symbols:close-rounded />
            </button>
          </section>
        </template>
      </VirtualList>
      <span class="no-data" v-if="!visibleTasks.length">{{ $t('no_task') }}</span>
    </div>
  </div>
</template>
<script setup lang="ts">
import { formatFileSize } from '@/lib/format'
import { upload } from '@/lib/api/file'
import { useTempStore, type IUploadItem } from '@/stores/temp'
import { computed, ref, watch } from 'vue'
import emitter from '@/plugins/eventbus'
import { useMainStore } from '@/stores/main'
import '@material/web/labs/badge/badge.js'
import { sortBy } from 'lodash-es'
import VirtualList from '@/components/virtualscroll'
import type { MdOutlinedSegmentedButton } from '@material/web/labs/segmentedbutton/outlined-segmented-button'
import { useI18n } from 'vue-i18n'

const tempStore = useTempStore()
const store = useMainStore()

const filterType = ref('in_progress')
const types = ['in_progress', 'completed']
const { t } = useI18n()
const listItemsRef = ref<HTMLDivElement>()

function chooseFilterType(value: string) {
  filterType.value = value
  const scroller = listItemsRef.value
  if (scroller) {
    scroller.scrollTop = 0
  }
}

const visibleTasks = computed(() => {
  return filterType.value === 'in_progress' ? inProgressTasks() : completedTasks()
})

const inProgressTasks = () => {
  const sortKeys: Map<string, number> = new Map()
  sortKeys.set('saving', 0)
  sortKeys.set('pending', 1)
  sortKeys.set('created', 2)
  return sortBy(
    tempStore.uploads.filter((it) => !['error', 'done'].includes(it.status)),
    (it) => sortKeys.get(it.status) ?? 0
  )
}

const completedTasks = () => {
  return tempStore.uploads.filter((it) => ['error', 'done'].includes(it.status))
}

const completedCount = computed(() => {
  return completedTasks().length
})

function getLabel(type: string) {
  const count = completedCount.value
  return t(type) + (type === 'completed' ? ` (${count})` : ` (${tempStore.uploads.length - count})`)
}

function deleteItem(item: IUploadItem) {
  tempStore.uploads.splice(tempStore.uploads.indexOf(item), 1)
  if (item.status === 'pending') {
    item.status = 'canceled'
    item.xhr?.abort()
  }
}

watch(
  () => tempStore.uploads,
  async () => {
    store.quick = 'task'
    const pending = tempStore.uploads.some((it) => it.status === 'pending')
    if (pending) {
      console.log('pending')
      return
    }
    doUpload()
  }
)

async function doUpload() {
  console.log('doUpload')
  // batch execute 5 uploads
  const uploads = tempStore.uploads.filter((it) => it.status === 'created').slice(0, 5)
  if (uploads.length === 0) {
    return
  }
  await Promise.all(
    uploads.map(async (item) => {
      item.status = 'pending'
      await upload(item, true)
      emitter.emit('upload_task_done', item)
    })
  )
  doUpload()
}
</script>
<style scoped lang="scss">
.list-items {
  overflow-y: auto;
  overflow-x: hidden;
  height: calc(100vh - 56px);
}
</style>
