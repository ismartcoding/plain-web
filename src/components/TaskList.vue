<template>
  <div class="tasks">
    <section class="list-items">
      <div v-for="item in visibleTasks" class="item" :key="item.file.name + item.file.size">
        <div class="title">{{ item.file.name }}</div>
        <div class="subtitle">{{ getSubtitle(item) }}</div>
        <button class="icon-button icon" @click.stop="deleteItem(item)">
          <md-ripple />
          <i-material-symbols:close-rounded />
        </button>
      </div>
    </section>
    <span class="no-data" v-if="!visibleTasks.length">{{ $t('no_task') }}</span>
  </div>
</template>
<script setup lang="ts">
import { formatFileSize } from '@/lib/format'
import { upload } from '@/lib/api/file'
import { useTempStore, type IUploadItem } from '@/stores/temp'
import { computed, watch } from 'vue'
import emitter from '@/plugins/eventbus'
import { chunk } from 'lodash-es'
import { useMainStore } from '@/stores/main'
import '@material/web/labs/badge/badge.js'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const tempStore = useTempStore()
const store = useMainStore()

const visibleTasks = computed(() => {
  return tempStore.uploads.filter((it: IUploadItem) => it.status !== 'done')
})

function getSubtitle(item: IUploadItem) {
  let text = `[${t(`upload_status.${item.status}`)}] (${formatFileSize(item.uploadedSize)} / ${formatFileSize(
    item.file.size
  )})`
  if (item.error) {
    text += ` ${item.error}`
  }

  return text
}

function deleteItem(item: IUploadItem) {
  tempStore.uploads.splice(tempStore.uploads.indexOf(item), 1)
  if (item.status === 'pending') {
    item.xhr?.abort()
  }
}

watch(
  () => tempStore.uploads,
  async (uploads) => {
    store.quick = 'task'
    const chunked = chunk(
      uploads.filter((it) => it.status === 'created'),
      5
    )
    for (const it of chunked) {
      // batch execute 5 uploads
      await Promise.all(
        it.map(async (item) => {
          item.status = 'pending'
          await upload(item, true)
          emitter.emit('upload_task_done', item)
        })
      )
    }
  }
)
</script>
<style scoped lang="scss">
.tasks {
  background-color: var(--md-sys-color-surface);
  overflow-x: hidden;
  overflow-y: auto;
  width: var(--quick-content-width);
  height: 100%;

  .no-data {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
  }
}
</style>
