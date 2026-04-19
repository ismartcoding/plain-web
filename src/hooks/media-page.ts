import { computed, inject, onActivated, onDeactivated, reactive, ref, watch, type Ref } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import toast from '@/components/toaster'
import { useMainStore } from '@/stores/main'
import { useTempStore } from '@/stores/temp'
import type { IBucket, IFilter, IItemTagsUpdatedEvent, IItemsTagsUpdatedEvent, IMediaItemsActionedEvent } from '@/lib/interfaces'
import type { IUploadItem } from '@/stores/temp'
import { decodeBase64 } from '@/lib/strutil'
import { noDataKey } from '@/lib/list'
import { useSearch } from '@/hooks/search'
import { useAddToTags } from '@/hooks/tags'
import { useSelectable } from '@/hooks/list'
import { useBuckets, useBucketsTags, useDeleteItems } from '@/hooks/media'
import { useDownload, useDownloadItems } from '@/hooks/files'
import { useDragDropUpload, useFileUpload } from '@/hooks/upload'
import { createBucketUploadTarget } from '@/hooks/media-upload'
import { useMediaRestore, useMediaTrash } from '@/hooks/media-trash'
import { useKeyEvents } from '@/hooks/key-events'
import { replacePath } from '@/plugins/router'
import emitter from '@/plugins/eventbus'
import { openModal } from '@/components/modal'
import UpdateTagRelationsModal from '@/components/UpdateTagRelationsModal.vue'
import KeyboardShortcutsModal from '@/components/KeyboardShortcutsModal.vue'
import { type DataType, FEATURE } from '@/lib/data'
import { getDirFromPath } from '@/lib/file'
import { generateDownloadFileName } from '@/lib/format'
import { hasFeature } from '@/lib/feature'
import { mediaKeyboardShortcuts } from '@/lib/shortcuts/media'

export interface MediaPageOptions {
  dataType: DataType
  routePath: string
  items: Ref<any[]>
  sortByRef: Ref<string>
  fileFilter: (name: string) => boolean
  downloadName: string
  uploadModalId: string
  uploadStorageKey: string
  doFetch: () => void
  getScrollMode: () => boolean
  setupScroll?: () => void
  teardownScroll?: () => void
  onBeforeFetch?: () => void
  onSort?: () => void
}

export function useMediaPage(options: MediaPageOptions) {
  const { dataType, routePath, items, sortByRef, fileFilter, doFetch } = options
  const isPhone = inject<Ref<boolean>>('isPhone')!
  const mainStore = useMainStore()
  const tempStore = useTempStore()
  const { app, urlTokenKey, uploads } = storeToRefs(tempStore)
  const { t } = useI18n()
  const { parseQ } = useSearch()
  const route = useRoute()

  const filter = reactive<IFilter>({ tagIds: [], bucketId: undefined })
  const uploadMenuVisible = ref(false)
  const moreMenuVisible = ref(false)
  const sorting = ref(false)
  const page = ref(1)
  const q = ref('')
  const limit = computed(() => mainStore.pageSize)
  const isActive = ref(false)

  const { input: fileInput, upload: uploadFiles, uploadChanged } = useFileUpload(uploads)
  const { input: dirFileInput, upload: uploadDir, uploadChanged: dirUploadChanged } = useFileUpload(uploads)
  const { dropping, fileDragEnter, fileDragLeave, dropFiles } = useDragDropUpload(uploads)

  const { tags, buckets, fetch: fetchBucketsTags } = useBucketsTags(dataType)
  const bucketsMap = computed(() => {
    const map: Record<string, IBucket> = {}
    buckets.value.forEach((it) => { map[it.id] = it })
    return map
  })
  const { addToTags } = useAddToTags(dataType, tags)
  const { deleteItems, deleteItem } = useDeleteItems()
  const { view: viewBucket } = useBuckets(dataType)

  const sel = useSelectable(items)
  const { downloadItems } = useDownloadItems(urlTokenKey, dataType, sel.clearSelection, () => generateDownloadFileName(options.downloadName))
  const { downloadFile } = useDownload(urlTokenKey)

  const { trashLoading, trash } = useMediaTrash()
  const { restoreLoading, restore } = useMediaRestore()

  const uploadTarget = createBucketUploadTarget({
    filter, buckets,
    picker: {
      title: t('upload_select_destination'),
      description: t('upload_select_destination_desc'),
      initialPath: '',
      modalId: options.uploadModalId,
      storageKey: options.uploadStorageKey,
    },
  })

  const gotoPage = (p: number) => {
    const qStr = route.query.q
    replacePath(mainStore, qStr ? `/${routePath}?page=${p}&q=${qStr}` : `/${routePath}?page=${p}`)
  }
  function onChangePageSize(size: number) {
    mainStore.pageSize = size
    const qStr = route.query.q
    replacePath(mainStore, qStr ? `/${routePath}?page=1&q=${qStr}` : `/${routePath}?page=1`)
  }

  const getQuery = () => sel.realAllChecked.value ? q.value : `ids:${sel.selectedIds.value.join(',')}`
  const trashInEditMode = () => {
    hasFeature(FEATURE.MEDIA_TRASH, app.value.osVersion)
      ? trash(dataType, getQuery())
      : deleteItems(dataType, sel.selectedIds.value, sel.realAllChecked.value, sel.total.value, q.value)
  }
  const { keyDown: pageKeyDown, keyUp: pageKeyUp } = useKeyEvents(
    sel.total, limit, page,
    () => sel.selectAll(),
    () => sel.clearSelection(),
    gotoPage, trashInEditMode,
  )

  function openKeyboardShortcuts() {
    openModal(KeyboardShortcutsModal, { title: t('keyboard_shortcuts'), shortcuts: mediaKeyboardShortcuts })
  }
  function handleMouseOverMode(e: MouseEvent, index: number) {
    sel.handleMouseOver(e, index)
  }
  function addItemToTags(item: { id: string; title: string; size: number; tags: { id: string }[] }) {
    openModal(UpdateTagRelationsModal, {
      type: dataType, tags: tags.value,
      item: { key: item.id, title: item.title, size: item.size },
      selected: tags.value.filter((it) => item.tags.some((t) => t.id === it.id)),
    })
  }
  function sort(value: string) {
    if (sortByRef.value === value) return
    sorting.value = true
    page.value = 1
    items.value = []
    options.onSort?.()
    sortByRef.value = value
    doFetch()
  }

  async function uploadFilesClick() { const dir = await uploadTarget.resolveTargetDir(); if (dir) uploadFiles(dir) }
  async function uploadDirClick() { const dir = await uploadTarget.resolveTargetDir(); if (dir) uploadDir(dir) }
  function dropFiles2(e: DragEvent) { dropFiles(e, uploadTarget.resolveTargetDir, (file) => fileFilter(file.name)) }

  const itemsTagsUpdatedHandler = (e: IItemsTagsUpdatedEvent) => { if (e.type === dataType) { sel.clearSelection(); doFetch() } }
  const itemTagsUpdatedHandler = (e: IItemTagsUpdatedEvent) => { if (e.type === dataType) doFetch() }
  const mediaItemsActionedHandler = (e: IMediaItemsActionedEvent) => { if (e.type === dataType) { sel.clearSelection(); doFetch() } }
  const uploadTaskDoneHandler = (r: IUploadItem) => {
    if (r.status === 'done' && fileFilter(r.fileName)) {
      const shouldRefresh = !filter.bucketId || buckets.value.some((b) =>
        b.id === filter.bucketId && b.topItems.some((ti) => r.dir.startsWith(getDirFromPath(ti)))
      )
      if (shouldRefresh) setTimeout(() => doFetch(), 1000)
      emitter.emit('media_items_actioned', { type: dataType, action: 'upload', query: '' })
    }
  }

  function applyRouteQuery() {
    const nextPage = parseInt(route.query.page?.toString() ?? '1')
    page.value = Number.isFinite(nextPage) && nextPage > 0 ? nextPage : 1
    q.value = decodeBase64(route.query.q?.toString() ?? '')
    parseQ(filter, q.value)
    options.onBeforeFetch?.()
    doFetch()
  }
  watch(() => route.fullPath, () => { if (isActive.value) applyRouteQuery() })

  onActivated(() => {
    fetchBucketsTags()
    isActive.value = true
    applyRouteQuery()
    emitter.on('item_tags_updated', itemTagsUpdatedHandler)
    emitter.on('items_tags_updated', itemsTagsUpdatedHandler)
    emitter.on('media_items_actioned', mediaItemsActionedHandler)
    emitter.on('upload_task_done', uploadTaskDoneHandler)
    window.addEventListener('keydown', pageKeyDown)
    window.addEventListener('keyup', pageKeyUp)
    if (options.getScrollMode()) options.setupScroll?.()
  })
  onDeactivated(() => {
    isActive.value = false
    emitter.off('item_tags_updated', itemTagsUpdatedHandler)
    emitter.off('items_tags_updated', itemsTagsUpdatedHandler)
    emitter.off('media_items_actioned', mediaItemsActionedHandler)
    emitter.off('upload_task_done', uploadTaskDoneHandler)
    window.removeEventListener('keydown', pageKeyDown)
    window.removeEventListener('keyup', pageKeyUp)
    options.teardownScroll?.()
  })

  return {
    isPhone, mainStore, tempStore, app, urlTokenKey, noDataKey,
    filter, page, q, sorting, uploadMenuVisible, moreMenuVisible, limit, dataType,
    fileInput, dirFileInput, uploadChanged, dirUploadChanged, dropping, fileDragEnter, fileDragLeave,
    tags, buckets, bucketsMap, addToTags, deleteItems, deleteItem, viewBucket,
    ...sel, downloadItems, downloadFile,
    trashLoading, trash, restoreLoading, restore,
    gotoPage, onChangePageSize, getQuery, sort, handleMouseOverMode,
    openKeyboardShortcuts, addItemToTags, uploadFilesClick, uploadDirClick, dropFiles2,
  }
}
