import router, { replacePath } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import { computed, onMounted, onUnmounted, reactive, ref, watch, type PropType } from 'vue'
import { useSearch } from '@/hooks/search'
import { decodeBase64, encodeBase64 } from '@/lib/strutil'
import type { IFilter, IMediaItemsActionedEvent } from '@/lib/interfaces'
import { storeToRefs } from 'pinia'
import { useTempStore } from '@/stores/temp'
import { DataType } from '@/lib/data'
import { initLazyQuery } from '@/lib/api/query'
import { buildQuery } from '@/lib/search'
import emitter from '@/plugins/eventbus'

export function useMediaSidebar(type: DataType, gql: string) {
  const mainStore = useMainStore()
  const { counter, app } = storeToRefs(useTempStore())
  const { parseQ } = useSearch()
  const filter = reactive<IFilter>({ tagIds: [] })
  const group = ref('')
  const trash = ref(false)
  const selectedTagId = ref('')
  const selectedBucketId = ref('')

  const total = computed(() => {
    if (type === DataType.IMAGE) return counter.value?.images ?? -1
    if (type === DataType.VIDEO) return counter.value?.videos ?? -1
    if (type === DataType.AUDIO) return counter.value?.audios ?? -1
    return -1
  })

  const totalTrash = computed(() => {
    if (type === DataType.IMAGE) return counter.value?.imagesTrash ?? -1
    if (type === DataType.VIDEO) return counter.value?.videosTrash ?? -1
    if (type === DataType.AUDIO) return counter.value?.audiosTrash ?? -1
    return -1
  })

  const { fetch } = initLazyQuery({
    handle: (data: { total: number; trash: number }) => {
      if (!data) return
      if (type === DataType.IMAGE) { counter.value.images = data.total; counter.value.imagesTrash = data.trash }
      else if (type === DataType.VIDEO) { counter.value.videos = data.total; counter.value.videosTrash = data.trash }
      else if (type === DataType.AUDIO) { counter.value.audios = data.total; counter.value.audiosTrash = data.trash }
    },
    document: gql,
    variables: () => {
      const dirs = mainStore.excludedDirs
      const dirParts = dirs.map((d) => (d.includes(' ') ? `excluded_dir:"${d}"` : `excluded_dir:${d}`))
      return { query: dirParts.join(' ') }
    },
  })

  function updateActive() {
    const route = router.currentRoute.value
    group.value = route.meta.group || ''
    fetch()
    const q = decodeBase64(route.query.q?.toString() ?? '')
    parseQ(filter, q)
    selectedTagId.value = filter.tagIds.length === 1 ? filter.tagIds[0] : ''
    trash.value = filter.trash ?? false
    selectedBucketId.value = filter.bucketId ?? ''
    if (selectedTagId.value && selectedBucketId.value) selectedTagId.value = ''
    if (trash.value) { selectedBucketId.value = ''; selectedTagId.value = '' }
  }

  updateActive()
  watch(() => router.currentRoute.value.fullPath, () => updateActive())

  function viewTrash() {
    replacePath(mainStore, `/${group.value}?q=${encodeBase64(buildQuery([{ name: 'trash', op: '', value: 'true' }]))}`)
  }

  function viewAll() { replacePath(mainStore, `/${group.value}`) }

  const mediaItemsActionedHandler = (event: IMediaItemsActionedEvent) => { if (event.type === type) fetch() }
  onMounted(() => emitter.on('media_items_actioned', mediaItemsActionedHandler))
  onUnmounted(() => emitter.off('media_items_actioned', mediaItemsActionedHandler))

  return { app, total, totalTrash, trash, selectedTagId, selectedBucketId, viewAll, viewTrash }
}
