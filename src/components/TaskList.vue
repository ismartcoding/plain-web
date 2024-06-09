<template>
  <div class="quick-content-main">
    <div class="top-app-bar">
      <button class="btn-icon" @click.prevent="store.quick = ''" v-tooltip="$t('close')">
        <md-ripple />
        <i-material-symbols:right-panel-close-outline />
      </button>
      <div class="title">{{ $t('header_actions.tasks') }} ({{ visibleTasks.length }})</div>
    </div>
    <div class="quick-content-body">
      <section class="list-items">
        <div v-for="item in visibleTasks" class="item" :key="item.file.name + item.file.size">
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
        </div>
      </section>
      <span class="no-data" v-if="!visibleTasks.length">{{ $t('no_task') }}</span>
    </div>
  </div>
</template>
<script setup lang="ts">
import { formatFileSize } from '@/lib/format'
import { upload } from '@/lib/api/file'
import { useTempStore, type IUploadItem } from '@/stores/temp'
import { computed, watch } from 'vue'
import emitter from '@/plugins/eventbus'
import { useMainStore } from '@/stores/main'
import '@material/web/labs/badge/badge.js'
import { sortBy } from 'lodash-es'

const tempStore = useTempStore()
const store = useMainStore()

const visibleTasks = computed(() => {
  const sortKeys: Map<string, number> = new Map()
  sortKeys.set('saving', 0)
  sortKeys.set('pending', 1)
  sortKeys.set('error', 2)
  sortKeys.set('created', 3)
  sortKeys.set('done', 4)
  return sortBy(tempStore.uploads, (it) => sortKeys.get(it.status) ?? 0)
})

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
<style scoped lang="scss"></style>
