<template>
  <div class="quick-content-main">
    <div class="top-app-bar">
      <button v-tooltip="$t('close')" class="btn-icon" @click="store.quick = ''">
        <i-lucide:x />
      </button>
      <div class="title">{{ $t('header_actions.tasks') }}</div>
    </div>

    <div class="quick-content-body">
      <div class="filter-bar">
        <div class="button-group">  
          <button v-for="type in types" :key="type" :class="{ 'selected': filterType === type }" @click="chooseFilterType(type)">
            {{ getLabel(type) }}
          </button>
        </div>
      </div>
      <VirtualList ref="listItemsRef" class="list-items" :data-key="'id'" :data-sources="visibleTasks" :estimate-size="80">
        <template #item="{ item }">
          <UploadBatchTaskItem :key="item.id" :batch-id="item.batchId" :uploads="item.uploads" />
        </template>
      </VirtualList>

      <div v-if="!visibleTasks.length" class="no-data">
        <div class="empty-content">
          <div class="empty-text">{{ $t('no_task') }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { addUploadTask } from '@/lib/upload/upload-queue'
import { useTempStore } from '@/stores/temp'
import { computed, ref, watch } from 'vue'
import { useMainStore } from '@/stores/main'
import VirtualList from '@/components/virtualscroll'
import UploadBatchTaskItem from '@/components/UploadBatchTaskItem.vue'
import { useI18n } from 'vue-i18n'

const tempStore = useTempStore()
const store = useMainStore()
const { t } = useI18n()

const filterType = ref('in_progress')
const types = ['in_progress', 'completed']
const listItemsRef = ref()

function chooseFilterType(value: string) {
  filterType.value = value
  const scroller = listItemsRef.value
  if (scroller) {
    scroller.scrollTop = 0
  }
}

type TaskListItem = { id: string; kind: 'upload_batch'; batchId: string; uploads: typeof tempStore.uploads }

const visibleTasks = computed<TaskListItem[]>(() => {
  return filterType.value === 'in_progress' ? inProgressTasks() : completedTasks()
})

const inProgressTasks = (): TaskListItem[] => {
  const sortKeys: Map<string, number> = new Map()
  sortKeys.set('uploading', 0)
  sortKeys.set('saving', 1)
  sortKeys.set('pending', 2)
  sortKeys.set('paused', 3)
  sortKeys.set('created', 4)

  const completedStates = new Set(['done', 'error', 'canceled'])
  const keyOf = (it: (typeof tempStore.uploads)[number]) => it.batchId || it.id

  const batchMap: Map<string, typeof tempStore.uploads> = new Map()
  for (const it of tempStore.uploads) {
    const k = keyOf(it)
    const list = batchMap.get(k)
    if (list) list.push(it)
    else batchMap.set(k, [it])
  }

  const batchStatus = (items: typeof tempStore.uploads) => {
    const statuses = items.map((u) => u.status)
    const doneStates = new Set(['done', 'canceled'])
    if (statuses.includes('error')) return 'error'
    if (statuses.includes('uploading')) return 'uploading'
    if (statuses.includes('saving')) return 'saving'
    if (statuses.includes('pending')) return 'pending'
    if (statuses.every((s) => s === 'paused')) return 'paused'
    if (statuses.length > 0 && statuses.every((s) => doneStates.has(s))) return 'done'
    return 'created'
  }

  const batchCreatedAt = (items: typeof tempStore.uploads) => {
    let min = Number.POSITIVE_INFINITY
    for (const it of items) {
      const v = typeof it.createdAt === 'number' ? it.createdAt : 0
      if (v < min) min = v
    }
    return min === Number.POSITIVE_INFINITY ? 0 : min
  }

  return Array.from(batchMap.entries())
    .filter(([_, items]) => items.some((it) => !completedStates.has(it.status)))
    .sort((a, b) => {
      const sa = sortKeys.get(batchStatus(a[1])) ?? 5
      const sb = sortKeys.get(batchStatus(b[1])) ?? 5
      if (sa !== sb) return sa - sb
      return batchCreatedAt(b[1]) - batchCreatedAt(a[1])
    })
    .map(([batchId, uploads]) => ({ id: batchId, kind: 'upload_batch', batchId, uploads }))
}

const completedTasks = (): TaskListItem[] => {
  const completedStates = new Set(['done', 'error', 'canceled'])
  const keyOf = (it: (typeof tempStore.uploads)[number]) => it.batchId || it.id

  const batchMap: Map<string, typeof tempStore.uploads> = new Map()
  for (const it of tempStore.uploads) {
    const k = keyOf(it)
    const list = batchMap.get(k)
    if (list) list.push(it)
    else batchMap.set(k, [it])
  }

  return Array.from(batchMap.entries())
    .filter(([_, items]) => items.length > 0 && items.every((it) => completedStates.has(it.status)))
    .map(([batchId, uploads]) => ({ id: batchId, kind: 'upload_batch', batchId, uploads }))
}

const completedCount = computed(() => {
  return completedTasks().length
})

const totalCount = computed(() => {
  return inProgressTasks().length + completedTasks().length
})

function getLabel(type: string) {
  const count = completedCount.value
  return t(type) + (type === 'completed' ? ` (${count})` : ` (${totalCount.value - count})`)
}

watch(
  () => tempStore.uploads,
  (newUploads, _) => {
    store.quick = 'task'
    const created = newUploads.filter((item) => item.status === 'created')
    if (created.length === 0) return

    const keyOf = (it: (typeof tempStore.uploads)[number]) => it.batchId || it.id
    const batches: Map<string, typeof tempStore.uploads> = new Map()
    for (const it of created) {
      const k = keyOf(it)
      const list = batches.get(k)
      if (list) list.push(it)
      else batches.set(k, [it])
    }

    const orderedBatches = Array.from(batches.entries()).sort((a, b) => {
      const ta = Math.min(...a[1].map((x) => x.createdAt || 0))
      const tb = Math.min(...b[1].map((x) => x.createdAt || 0))
      return ta - tb
    })

    for (const [_, newItems] of orderedBatches) {
      for (const item of newItems) {
        if (item.status !== 'created') continue
        addUploadTask(item, true)
        item.status = 'pending'
      }
    }
  }
)
</script>

<style scoped lang="scss">
.filter-bar {
  padding: 8px 16px;

  .button-group {
    width: 100%;
  }
}

.list-items {
  padding-block: 8px;
  overflow-y: auto;
  overflow-x: hidden;
  height: calc(100vh - 100px);
}

.empty-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: var(--md-sys-color-on-surface-variant);
}

.empty-text {
  font-size: 1rem;
  opacity: 0.7;
}
</style>
