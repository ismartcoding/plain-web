import { useTempStore } from '@/stores/temp'
import { computed, ref, watch } from 'vue'
import { useMainStore } from '@/stores/main'
import { useI18n } from 'vue-i18n'
import { addUploadTask } from '@/lib/upload/upload-queue'

type Upload = ReturnType<typeof useTempStore>['uploads'][number]
type TaskListItem = { id: string; kind: 'upload_batch'; batchId: string; uploads: Upload[] }

const completedStates = new Set(['done', 'error', 'canceled'])
const keyOf = (it: Upload) => it.batchId || it.id

function groupByBatch(uploads: Upload[]): Map<string, Upload[]> {
  const map = new Map<string, Upload[]>()
  for (const it of uploads) {
    const k = keyOf(it)
    const list = map.get(k)
    if (list) list.push(it)
    else map.set(k, [it])
  }
  return map
}

function batchStatus(items: Upload[]): string {
  const statuses = items.map((u) => u.status)
  if (statuses.includes('error')) return 'error'
  if (statuses.includes('uploading')) return 'uploading'
  if (statuses.includes('saving')) return 'saving'
  if (statuses.includes('pending')) return 'pending'
  if (statuses.every((s) => s === 'paused')) return 'paused'
  if (statuses.length > 0 && statuses.every((s) => s === 'done' || s === 'canceled')) return 'done'
  return 'created'
}

function inProgressTasks(uploads: Upload[]): TaskListItem[] {
  const sortKeys = new Map([['uploading', 0], ['saving', 1], ['pending', 2], ['paused', 3], ['created', 4]])
  const batchCreatedAt = (items: Upload[]) => {
    let min = Number.POSITIVE_INFINITY
    for (const it of items) { const v = typeof it.createdAt === 'number' ? it.createdAt : 0; if (v < min) min = v }
    return min === Number.POSITIVE_INFINITY ? 0 : min
  }
  return Array.from(groupByBatch(uploads).entries())
    .filter(([_, items]) => items.some((it) => !completedStates.has(it.status)))
    .sort((a, b) => {
      const sa = sortKeys.get(batchStatus(a[1])) ?? 5, sb = sortKeys.get(batchStatus(b[1])) ?? 5
      return sa !== sb ? sa - sb : batchCreatedAt(b[1]) - batchCreatedAt(a[1])
    })
    .map(([batchId, uploads]) => ({ id: batchId, kind: 'upload_batch' as const, batchId, uploads }))
}

function completedTasksList(uploads: Upload[]): TaskListItem[] {
  return Array.from(groupByBatch(uploads).entries())
    .filter(([_, items]) => items.length > 0 && items.every((it) => completedStates.has(it.status)))
    .map(([batchId, uploads]) => ({ id: batchId, kind: 'upload_batch' as const, batchId, uploads }))
}

export function useUploadList() {
  const tempStore = useTempStore()
  const store = useMainStore()
  const { t } = useI18n()
  const filterType = ref('in_progress')
  const types = ['in_progress', 'completed']
  const listItemsRef = ref()

  function chooseFilterType(value: string) {
    filterType.value = value
    if (listItemsRef.value) listItemsRef.value.scrollTop = 0
  }

  const visibleTasks = computed<TaskListItem[]>(() =>
    filterType.value === 'in_progress' ? inProgressTasks(tempStore.uploads) : completedTasksList(tempStore.uploads)
  )

  const completedCount = computed(() => completedTasksList(tempStore.uploads).length)
  const totalCount = computed(() => inProgressTasks(tempStore.uploads).length + completedCount.value)

  function getLabel(type: string) {
    return t(type) + (type === 'completed' ? ` (${completedCount.value})` : ` (${totalCount.value - completedCount.value})`)
  }

  watch(() => tempStore.uploads, (newUploads) => {
    store.quick = 'upload'
    const created = newUploads.filter((item) => item.status === 'created')
    if (created.length === 0) return
    const batches = new Map<string, typeof newUploads>()
    for (const it of created) { const k = keyOf(it); const list = batches.get(k); if (list) list.push(it); else batches.set(k, [it]) }
    const ordered = Array.from(batches.entries()).sort((a, b) => Math.min(...a[1].map((x) => x.createdAt || 0)) - Math.min(...b[1].map((x) => x.createdAt || 0)))
    for (const [_, newItems] of ordered) { for (const item of newItems) { if (item.status !== 'created') continue; addUploadTask(item, true); item.status = 'pending' } }
  })

  return { store, filterType, types, listItemsRef, visibleTasks, chooseFilterType, getLabel }
}
