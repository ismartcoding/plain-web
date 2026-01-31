<template>
  <!-- Header variant: single input, filter dropdown is inside TokenSearchField -->
  <div class="header-search">
    <TokenSearchField
      ref="inputRef"
      class="header-search-field"
      :text="text"
      :tokens="uiTokens"
      enter-submits
      :placeholder="resolvedPlaceholder"
      :key-options="keyOptions"
      :value-options="valueOptions"
      @update:text="onFreeTextChange"
      @update:tokens="onUiTokensChange"
      @enter="submitFromHeader"
      @history:select="applyHistoryQ"
      @history:delete="deleteHistoryItem"
      @history:clear="clearHistoryForPage"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useMainStore } from '@/stores/main'
import { replacePath } from '@/plugins/router'
import { buildQuery, parseQuery } from '@/lib/search'
import { decodeBase64, encodeBase64 } from '@/lib/strutil'
import { isEditableTarget } from '@/lib/dom'
import type { IBucket, IFeed, IFilter, IFileFilter, ITag, IType } from '@/lib/interfaces'
import { useSearch as useMediaSearch } from '@/hooks/search'
import { useSearch as useFilesSearch } from '@/hooks/files'
import { DataType } from '@/lib/data'
import { useBucketsTags } from '@/hooks/media'
import TokenSearchField, { type Token as UiToken } from '@/components/TokenSearchField.vue'
import { feedsGQL, initLazyQuery } from '@/lib/api/query'
import { usePerPageSearchHistory } from '@/components/header-search/history'
import { formatHistoryLabel } from '@/components/header-search/formatHistoryLabel'
import { keyOptionsForGroup, valueOptionsForGroup } from '@/components/header-search/options'
import { decodedQuery, parseCurrentFields, splitOpValue } from '@/components/header-search/q'

type Kind = 'global' | 'media' | 'files'

const props = withDefaults(
  defineProps<{
    kind?: Kind
    placeholder?: string
    enableSlashFocus?: boolean

    // Global (header) navigation
    targetPath?: string
    syncRouteQ?: boolean

    // Media-like (SearchInput)
    filter?: IFilter
    getUrl?: (q: string) => string
    tags?: ITag[]
    buckets?: IBucket[]
    types?: IType[]
    showTrash?: boolean

    // Files-like (FileSearchInput)
    fileFilter?: IFileFilter
    getFileUrl?: (q: string) => string
    navigateToDir?: (dir: string) => void
  }>(),
  {
    kind: 'global',
    placeholder: '',
    enableSlashFocus: true,
    targetPath: '',
    syncRouteQ: true,

    filter: undefined,
    getUrl: undefined,
    tags: () => [],
    buckets: () => [],
    types: () => [],
    showTrash: false,

    fileFilter: undefined,
    getFileUrl: undefined,
    navigateToDir: () => {},
  }
)

const router = useRouter()
const mainStore = useMainStore()
const { t } = useI18n()

const inputRef = ref<{ focus: () => void } | null>(null)
const text = ref('')

const { buildQ: buildMediaQ, copyFilter: copyMediaFilter, parseQ: parseMediaQ } = useMediaSearch()
const { buildQ: buildFilesQ, parseQ: parseFilesQ } = useFilesSearch()

const mediaLocalFilter: IFilter = reactive({ tagIds: [] })
const filesLocalFilter: IFileFilter = reactive({
  showHidden: false,
  type: '',
  rootPath: '',
  parent: '',
  text: '',
  fileSize: undefined,
})

const callsLocal = reactive({
  duration: '',
  startTime: '',
})

const routeGroup = computed(() => String(router.currentRoute.value.meta?.group ?? ''))
const showMediaFilters = computed(() => routeGroup.value === 'audios' || routeGroup.value === 'videos' || routeGroup.value === 'images')
const showFilesFilters = computed(() => routeGroup.value === 'files')
const showAppsFilters = computed(() => routeGroup.value === 'apps')
const showMessagesFilters = computed(() => routeGroup.value === 'messages')
const showCallsFilters = computed(() => routeGroup.value === 'calls')
const showFeedsFilters = computed(() => routeGroup.value === 'feeds')

const resolvedPlaceholder = computed(() => props.placeholder || t('search_hint'))

const { tags: audioTags, buckets: audioBuckets, fetch: fetchAudioBucketsTags } = useBucketsTags(DataType.AUDIO)
const { tags: videoTags, buckets: videoBuckets, fetch: fetchVideoBucketsTags } = useBucketsTags(DataType.VIDEO)
const { tags: imageTags, buckets: imageBuckets, fetch: fetchImageBucketsTags } = useBucketsTags(DataType.IMAGE)

const mediaTags = computed<ITag[]>(() => {
  if (routeGroup.value === 'audios') return audioTags.value
  if (routeGroup.value === 'videos') return videoTags.value
  if (routeGroup.value === 'images') return imageTags.value
  return []
})

const mediaBuckets = computed<IBucket[]>(() => {
  if (routeGroup.value === 'audios') return audioBuckets.value
  if (routeGroup.value === 'videos') return videoBuckets.value
  if (routeGroup.value === 'images') return imageBuckets.value
  return []
})

const sortedMediaBuckets = computed<IBucket[]>(() =>
  [...(mediaBuckets.value ?? [])].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', undefined, { numeric: true, sensitivity: 'base' }))
)

const feeds = ref<IFeed[]>([])
const { fetch: fetchFeeds } = initLazyQuery({
  handle: (data: { feeds: IFeed[] }, error: string) => {
    if (error) return
    feeds.value = (data?.feeds ?? []) as IFeed[]
  },
  document: feedsGQL,
  variables: () => ({}),
})

const kind = computed<Kind>(() => props.kind ?? 'global')
const currentEncodedQ = computed(() => router.currentRoute.value.query.q?.toString() ?? '')

const { historyQ, historyValueOptions, rememberHistoryDecoded, rememberHistoryBase64, deleteHistoryItem, clearHistoryForPage } =
  usePerPageSearchHistory({
    router,
    mainStore,
    max: 10,
    decodeBase64,
    formatLabel: (decoded) =>
      formatHistoryLabel({
        decoded,
        group: routeGroup.value,
        t,
        mediaBuckets: mediaBuckets.value ?? [],
        mediaTags: mediaTags.value ?? [],
        feeds: feeds.value ?? [],
      }),
  })

const keyOptions = computed(() => {
  const hasHistory = (historyQ.value ?? []).length > 0
  return keyOptionsForGroup(routeGroup.value, hasHistory)
})

const valueOptions = computed<Record<string, any[]>>(() => {
  return valueOptionsForGroup({
    group: routeGroup.value,
    t,
    history: historyValueOptions.value,
    mediaTags: mediaTags.value ?? [],
    mediaBuckets: mediaBuckets.value ?? [],
    feeds: feeds.value ?? [],
  })
})

const uiTokens = computed<UiToken[]>(() => {
  const tokens: UiToken[] = []

  if (showAppsFilters.value) {
    if (mediaLocalFilter.type) {
      tokens.push({ key: 'type', value: mediaLocalFilter.type })
    }
    return tokens
  }

  if (showMediaFilters.value) {
    if (mediaLocalFilter.bucketId) {
      const b = (mediaBuckets.value ?? []).find((it) => it.id === mediaLocalFilter.bucketId)
      if (b) tokens.push({ key: 'bucket', value: b.name })
    }

    for (const id of mediaLocalFilter.tagIds ?? []) {
      const tag = (mediaTags.value ?? []).find((it) => it.id === id)
      if (tag) tokens.push({ key: 'tag', value: tag.name })
    }

    return tokens
  }

  if (showFilesFilters.value) {
    if (filesLocalFilter.fileSize) {
      tokens.push({ key: 'file_size', value: filesLocalFilter.fileSize })
    }
    return tokens
  }

  if (showMessagesFilters.value) {
    if (mediaLocalFilter.type) {
      tokens.push({ key: 'type', value: mediaLocalFilter.type })
    }
    return tokens
  }

  if (showCallsFilters.value) {
    if (mediaLocalFilter.type) {
      tokens.push({ key: 'type', value: mediaLocalFilter.type })
    }
    if (callsLocal.duration) tokens.push({ key: 'duration', value: callsLocal.duration })
    if (callsLocal.startTime) tokens.push({ key: 'start_time', value: callsLocal.startTime })
    return tokens
  }

  if (showFeedsFilters.value) {
    if (mediaLocalFilter.feedId) {
      const f = (feeds.value ?? []).find((it) => it.id === mediaLocalFilter.feedId)
      tokens.push({ key: 'feed_id', value: f?.name ?? mediaLocalFilter.feedId })
    }
    return tokens
  }

  return tokens
})

function onFreeTextChange(v: string) {
  text.value = v
}

function onUiTokensChange(tokens: UiToken[]) {
  if (showAppsFilters.value) {
    const typeTok = tokens.find((it) => it.key === 'type')
    mediaLocalFilter.type = typeTok?.value
    mediaLocalFilter.text = text.value
    return
  }

  if (showMediaFilters.value) {
    const nextTagIds: string[] = []
    for (const tok of tokens) {
      if (tok.key !== 'tag') continue
      const tag = (mediaTags.value ?? []).find((t) => t.name.toLowerCase() === tok.value.toLowerCase())
      if (tag) nextTagIds.push(tag.id)
    }

    const bucketTok = tokens.find((it) => it.key === 'bucket')
    const bucket = bucketTok ? (mediaBuckets.value ?? []).find((b) => b.name.toLowerCase() === bucketTok.value.toLowerCase()) : undefined

    mediaLocalFilter.tagIds = nextTagIds
    mediaLocalFilter.bucketId = bucket?.id
    mediaLocalFilter.text = text.value
    return
  }

  if (showFilesFilters.value) {
    const fileSizeTok = tokens.find((it) => it.key === 'file_size')
    filesLocalFilter.fileSize = fileSizeTok?.value
    filesLocalFilter.text = text.value
    return
  }

  if (showMessagesFilters.value) {
    const typeTok = tokens.find((it) => it.key === 'type')
    mediaLocalFilter.type = typeTok?.value
    mediaLocalFilter.text = text.value
    return
  }

  if (showCallsFilters.value) {
    mediaLocalFilter.type = tokens.find((it) => it.key === 'type')?.value
    callsLocal.duration = tokens.find((it) => it.key === 'duration')?.value ?? ''
    callsLocal.startTime = tokens.find((it) => it.key === 'start_time')?.value ?? ''
    mediaLocalFilter.text = text.value
    return
  }

  if (showFeedsFilters.value) {
    const feedTok = tokens.find((it) => it.key === 'feed_id')
    const feed = feedTok ? (feeds.value ?? []).find((f) => f.name.toLowerCase() === feedTok.value.toLowerCase() || f.id === feedTok.value) : undefined
    mediaLocalFilter.feedId = feed?.id
    mediaLocalFilter.text = text.value
    return
  }
}

function buildNextQ(nextText: string, nextShowHidden: boolean) {
  const fields = parseCurrentFields(currentEncodedQ.value).filter((f) => f.name !== 'text' && f.name !== 'show_hidden')
  const v = nextText.trim()
  if (v) {
    fields.push({ name: 'text', op: '', value: v })
  }
  if (nextShowHidden) {
    fields.push({ name: 'show_hidden', op: '', value: 'true' })
  }
  if (fields.length === 0) return ''
  return encodeBase64(buildQuery(fields))
}

function buildNextMediaQ(next: IFilter) {
  const fields = parseCurrentFields(currentEncodedQ.value).filter((f) => f.name !== 'text' && f.name !== 'tag_id' && f.name !== 'bucket_id' && f.name !== 'type' && f.name !== 'trash')

  if (next.bucketId) {
    fields.push({ name: 'bucket_id', op: '', value: next.bucketId })
  }

  if (next.trash !== undefined) {
    fields.push({ name: 'trash', op: '', value: next.trash ? 'true' : 'false' })
  }

  if (next.type) {
    fields.push({ name: 'type', op: '', value: next.type })
  }

  for (const id of next.tagIds ?? []) {
    fields.push({ name: 'tag_id', op: '', value: id })
  }

  if (next.text !== undefined) {
    const v = String(next.text).trim()
    if (v) {
      fields.push({ name: 'text', op: '', value: v })
    }
  }

  if (fields.length === 0) return ''
  return encodeBase64(buildQuery(fields))
}

function buildNextMessagesQ() {
  const fields = parseCurrentFields(currentEncodedQ.value).filter((f) => f.name !== 'text' && f.name !== 'type')
  if (mediaLocalFilter.type) {
    fields.push({ name: 'type', op: '', value: mediaLocalFilter.type })
  }
  const v = text.value.trim()
  if (v) fields.push({ name: 'text', op: '', value: v })
  if (fields.length === 0) return ''
  return encodeBase64(buildQuery(fields))
}

function buildNextCallsQ() {
  const fields = parseCurrentFields(currentEncodedQ.value).filter((f) => f.name !== 'text' && f.name !== 'type' && f.name !== 'duration' && f.name !== 'start_time')
  if (mediaLocalFilter.type) {
    fields.push({ name: 'type', op: '', value: mediaLocalFilter.type })
  }

  if (callsLocal.duration) {
    const { op, value } = splitOpValue(callsLocal.duration)
    if (value) fields.push({ name: 'duration', op, value })
  }

  if (callsLocal.startTime) {
    const { op, value } = splitOpValue(callsLocal.startTime)
    if (value) fields.push({ name: 'start_time', op, value })
  }

  const v = text.value.trim()
  if (v) fields.push({ name: 'text', op: '', value: v })
  if (fields.length === 0) return ''
  return encodeBase64(buildQuery(fields))
}

function buildNextFeedsQ() {
  const fields = parseCurrentFields(currentEncodedQ.value).filter((f) => f.name !== 'text' && f.name !== 'feed_id' && f.name !== 'today' && f.name !== 'tag_id')
  if (mediaLocalFilter.feedId) {
    fields.push({ name: 'feed_id', op: '', value: mediaLocalFilter.feedId })
  }
  const v = text.value.trim()
  if (v) fields.push({ name: 'text', op: '', value: v })
  if (fields.length === 0) return ''
  return encodeBase64(buildQuery(fields))
}

function replaceCurrentRouteQ(q: string) {
  const route = router.currentRoute.value
  const targetPath = props.targetPath || (route.path === '/' ? '/files' : route.path)
  const nextQuery: Record<string, any> = { ...route.query }
  delete nextQuery.page
  delete nextQuery.q
  if (q) nextQuery.q = q

  const fullPath = router.resolve({ path: targetPath, query: nextQuery }).fullPath
  replacePath(mainStore, fullPath)

  if (q) rememberHistoryBase64(q)
}

function applyHistoryQ(q: string) {
  if (!q) return

  try {
    const fields = parseQuery(q)
    const textField = fields.find((it) => it.name === 'text')
    text.value = textField?.value ?? ''
  } catch {
    // ignore
  }
  parseMediaQ(mediaLocalFilter, q)
  parseFilesQ(filesLocalFilter, q)

  const qBase64 = encodeBase64(q)

  if (kind.value === 'global') {
    replaceCurrentRouteQ(qBase64)
    return
  }

  if (kind.value === 'media') {
    if (!props.getUrl) return
    replacePath(mainStore, props.getUrl(qBase64))
    rememberHistoryDecoded(q)
    return
  }

  if (kind.value === 'files') {
    if (!props.getFileUrl) return
    replacePath(mainStore, props.getFileUrl(qBase64))
    rememberHistoryDecoded(q)
    return
  }
}

function syncFromRoute() {
  if (!props.syncRouteQ) return

  const fields = parseCurrentFields(currentEncodedQ.value)
  const textField = fields.find((it) => it.name === 'text')
  text.value = textField?.value ?? ''

  const durationField = fields.find((it) => it.name === 'duration')
  callsLocal.duration = durationField ? `${durationField.op}${durationField.value}` : ''
  const startTimeField = fields.find((it) => it.name === 'start_time')
  callsLocal.startTime = startTimeField ? `${startTimeField.op}${startTimeField.value}` : ''

  const decoded = decodedQuery(currentEncodedQ.value)
  parseMediaQ(mediaLocalFilter, decoded)
  parseFilesQ(filesLocalFilter, decoded)
}

function submitGlobal(value?: string) {
  mediaLocalFilter.text = value ?? text.value
  filesLocalFilter.text = value ?? text.value
  const q = buildNextQ(value ?? text.value, filesLocalFilter.showHidden)
  replaceCurrentRouteQ(q)
}

function isAbsolutePath(input: string) {
  return input.startsWith('/')
}

function applyPanel() {
  if (kind.value === 'global') {
    submitGlobal(text.value)
  } else if (kind.value === 'media') {
    if (!props.filter || !props.getUrl) return
    const nextFilter: IFilter = {
      ...props.filter,
      text: text.value,
      tagIds: [...(mediaLocalFilter.tagIds ?? [])],
      bucketId: mediaLocalFilter.bucketId,
      type: mediaLocalFilter.type,
      trash: mediaLocalFilter.trash,
    }

    const q = buildMediaQ(nextFilter)
    replacePath(mainStore, props.getUrl(q))
    if (q) rememberHistoryBase64(q)
  } else if (kind.value === 'files') {
    if (!props.fileFilter || !props.getFileUrl) return
    const inputText = text.value.trim()
    if (inputText && isAbsolutePath(inputText) && props.navigateToDir) {
      props.navigateToDir(inputText)
      return
    }

    const nextFilter: IFileFilter = {
      ...props.fileFilter,
      ...filesLocalFilter,
      text: text.value,
    }

    const q = buildFilesQ(nextFilter)
    replacePath(mainStore, props.getFileUrl(q))
    if (q) rememberHistoryBase64(q)
  }
}

function submitFromHeader() {
  if (kind.value === 'global') {
    if (showMediaFilters.value) {
      const q = buildNextMediaQ({ ...mediaLocalFilter, text: text.value })
      replaceCurrentRouteQ(q)
      return
    }

    if (showAppsFilters.value) {
      const q = buildNextMediaQ({ tagIds: [], type: mediaLocalFilter.type, text: text.value })
      replaceCurrentRouteQ(q)
      return
    }

    if (showFilesFilters.value) {
      const nextFilter: IFileFilter = {
        ...filesLocalFilter,
        text: text.value,
      }
      const q = buildFilesQ(nextFilter)
      replaceCurrentRouteQ(q)
      return
    }

    if (showMessagesFilters.value) {
      const q = buildNextMessagesQ()
      replaceCurrentRouteQ(q)
      return
    }

    if (showCallsFilters.value) {
      const q = buildNextCallsQ()
      replaceCurrentRouteQ(q)
      return
    }

    if (showFeedsFilters.value) {
      const q = buildNextFeedsQ()
      replaceCurrentRouteQ(q)
      return
    }

    submitGlobal(text.value)
    return
  }
  applyPanel()
}

function onGlobalKeydown(event: KeyboardEvent) {
  if (!props.enableSlashFocus) return
  if (event.key !== '/') return
  if (event.ctrlKey || event.metaKey || event.altKey) return
  if (isEditableTarget(event.target)) return
  event.preventDefault()
  inputRef.value?.focus()
}

watch(
  () => router.currentRoute.value.fullPath,
  () => {
    syncFromRoute()
  },
  { immediate: true }
)

watch(
  () => routeGroup.value,
  (g) => {
    if (g === 'audios') {
      fetchAudioBucketsTags()
    } else if (g === 'videos') {
      fetchVideoBucketsTags()
    } else if (g === 'images') {
      fetchImageBucketsTags()
    } else if (g === 'feeds') {
      fetchFeeds()
    }
  },
  { immediate: true }
)

watch(
  () => props.filter,
  (v) => {
    if (!v) return
    copyMediaFilter(v, mediaLocalFilter)
    text.value = v.text ?? ''
  },
  { immediate: true, deep: true }
)

watch(
  () => props.fileFilter,
  (v) => {
    if (!v) return
    Object.assign(filesLocalFilter, v)
    text.value = v.text ?? ''
  },
  { immediate: true, deep: true }
)

onMounted(() => {
  window.addEventListener('keydown', onGlobalKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onGlobalKeydown)
})

defineExpose({
  focus: () => inputRef.value?.focus(),
})
</script>

<style lang="scss" scoped>
.header-search {
  min-width: min(520px, 46vw);
}

.header-search :deep(.header-search-field) {
  width: 100%;
}
</style>
