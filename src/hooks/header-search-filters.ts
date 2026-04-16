import { computed, type Ref } from 'vue'
import type { IBucket, IFeed, IFilter, IFileFilter, ITag } from '@/lib/interfaces'
import type { Token as UiToken } from '@/lib/token-search-dom'

interface CallsLocal { duration: string; startTime: string }

export function useHeaderSearchTokens(
  routeGroup: Ref<string>,
  text: Ref<string>,
  mediaLocalFilter: IFilter,
  filesLocalFilter: IFileFilter,
  callsLocal: CallsLocal,
  mediaTags: Ref<ITag[]>,
  mediaBuckets: Ref<IBucket[]>,
  messageTags: Ref<ITag[]>,
  feeds: Ref<IFeed[]>,
  showMediaFilters: Ref<boolean>,
  showFilesFilters: Ref<boolean>,
  showAppsFilters: Ref<boolean>,
  showMessagesFilters: Ref<boolean>,
  showCallsFilters: Ref<boolean>,
  showFeedsFilters: Ref<boolean>,
  showDocsFilters: Ref<boolean>,
  docsExt: Ref<string>,
) {
  const uiTokens = computed<UiToken[]>(() => {
    const tokens: UiToken[] = []

    if (showAppsFilters.value) {
      if (mediaLocalFilter.type) tokens.push({ key: 'type', value: mediaLocalFilter.type })
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
      if (filesLocalFilter.fileSize) tokens.push({ key: 'file_size', value: filesLocalFilter.fileSize })
      return tokens
    }

    if (showDocsFilters.value) {
      if (docsExt.value) tokens.push({ key: 'ext', value: docsExt.value })
      if (filesLocalFilter.fileSize) tokens.push({ key: 'file_size', value: filesLocalFilter.fileSize })
      return tokens
    }

    if (showMessagesFilters.value) {
      if (mediaLocalFilter.type) tokens.push({ key: 'type', value: mediaLocalFilter.type })
      for (const id of mediaLocalFilter.tagIds ?? []) {
        const tag = (messageTags.value ?? []).find((it) => it.id === id)
        if (tag) tokens.push({ key: 'tag', value: tag.name })
      }
      return tokens
    }

    if (showCallsFilters.value) {
      if (mediaLocalFilter.type) tokens.push({ key: 'type', value: mediaLocalFilter.type })
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

  function onUiTokensChange(tokens: UiToken[]) {
    if (showAppsFilters.value) {
      mediaLocalFilter.type = tokens.find((it) => it.key === 'type')?.value
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
      filesLocalFilter.fileSize = tokens.find((it) => it.key === 'file_size')?.value
      filesLocalFilter.text = text.value
      return
    }

    if (showDocsFilters.value) {
      docsExt.value = tokens.find((it) => it.key === 'ext')?.value ?? ''
      filesLocalFilter.fileSize = tokens.find((it) => it.key === 'file_size')?.value
      filesLocalFilter.text = text.value
      return
    }

    if (showMessagesFilters.value) {
      mediaLocalFilter.type = tokens.find((it) => it.key === 'type')?.value
      const nextTagIds: string[] = []
      for (const tok of tokens) {
        if (tok.key !== 'tag') continue
        const tag = (messageTags.value ?? []).find((t) => t.name.toLowerCase() === tok.value.toLowerCase())
        if (tag) nextTagIds.push(tag.id)
      }
      mediaLocalFilter.tagIds = nextTagIds
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

  return { uiTokens, onUiTokensChange }
}
