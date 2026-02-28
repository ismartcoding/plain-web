import { ref, computed, watch } from 'vue'
import type { ComputedRef } from 'vue'
import { getGroupDateKey, formatGroupDateLabel } from '@/lib/file'

export interface GroupEntry<T> {
  item: T
  idx: number
}

export interface MediaGroup<T> {
  date: string
  dateLabel: string
  entries: GroupEntry<T>[]
}

interface MediaBase {
  id: string
  takenAt?: string
  createdAt: string
}

/**
 * Shared composable for grouped-by-date + infinite-scroll paging logic.
 * getLoading / doFetch are passed as getter functions to allow calling this
 * before initLazyQuery (their values are only accessed inside callbacks).
 */
export function useGroupedScroll<T extends MediaBase>(options: {
  items: { value: T[] }
  getLoading: () => boolean
  limit: ComputedRef<number> | { readonly value: number }
  page: { value: number }
  doFetch: () => void
  getScrollPaging: () => boolean
  getGroupBy: () => string
}) {
  const noMore = ref(false)
  const sentinel = ref<HTMLElement | null>(null)
  const isGroupMode = computed(() => options.getGroupBy() === 'TAKEN_AT')
  const scrollMode = computed(() => isGroupMode.value || options.getScrollPaging())

  const groupedItems = computed<MediaGroup<T>[]>(() => {
    if (!isGroupMode.value) return []
    const groups = new Map<string, GroupEntry<T>[]>()
    options.items.value.forEach((item, idx) => {
      const key = getGroupDateKey(item.takenAt, item.createdAt)
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push({ item, idx })
    })
    return Array.from(groups.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, entries]) => ({ date, dateLabel: formatGroupDateLabel(date), entries }))
  })

  function loadMore() {
    if (noMore.value || options.getLoading() || !scrollMode.value) return
    options.page.value++
    options.doFetch()
  }

  // Call this after each page of data is successfully appended to proactively
  // fetch the next page before the user reaches the sentinel.
  function prefetchNext() {
    if (noMore.value || !scrollMode.value) return
    // Use a microtask delay so the loading state has been updated by the caller first
    setTimeout(() => loadMore(), 0)
  }

  let observer: IntersectionObserver | null = null

  function setupSentinelObserver() {
    if (observer) { observer.disconnect(); observer = null }
    if (!sentinel.value) return
    observer = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) loadMore() },
      { rootMargin: '200px' }
    )
    observer.observe(sentinel.value)
  }

  function teardownObserver() {
    observer?.disconnect()
    observer = null
  }

  watch(scrollMode, (val) => {
    if (val) setTimeout(setupSentinelObserver, 100)
    else teardownObserver()
  })

  watch(sentinel, (el) => {
    if (el && scrollMode.value) setupSentinelObserver()
  })

  return { noMore, sentinel, isGroupMode, scrollMode, groupedItems, setupSentinelObserver, teardownObserver, prefetchNext }
}
