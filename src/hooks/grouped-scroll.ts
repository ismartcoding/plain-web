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

  // Call this after each page of data is successfully appended.
  // Only triggers the next load if the sentinel is still visible (user scrolled near the bottom).
  // This prevents an infinite chain of fetches — at most one extra page is prefetched.
  function prefetchNext() {
    if (noMore.value || !scrollMode.value || !sentinel.value || !observer) return
    // Check if the sentinel is currently intersecting (visible in or near the viewport).
    // If not visible, let the IntersectionObserver handle subsequent loads naturally.
    const rect = sentinel.value.getBoundingClientRect()
    const rootMarginPx = 200
    if (rect.top <= window.innerHeight + rootMarginPx) {
      setTimeout(() => loadMore(), 0)
    }
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
