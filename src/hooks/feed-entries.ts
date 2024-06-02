import { feedEntriesGQL, initLazyQuery } from '@/lib/api/query'
import type { IFeedEntry, IFeedEntryItem } from '@/lib/interfaces'
import { ref, type Ref } from 'vue'
import toast from '@/components/toaster'
import { useI18n } from 'vue-i18n'

export const useList = (items: Ref<IFeedEntryItem[]>, q: Ref<string>, total: Ref<number>) => {
  const { t } = useI18n()

  const page = ref(1)
  const limit = 50
  const noMore = ref(false)
  const { loading, fetch } = initLazyQuery({
    handle: (data: any, error: string) => {
      if (error) {
        toast(t(error), 'error')
      } else {
        if (data) {
          if (data.feedEntries.length < limit) {
            noMore.value = true
          }
          const newItems = data.feedEntries.map((it: IFeedEntry) => ({ ...it, checked: false }))
          if (page.value === 1) {
            items.value = newItems
          } else {
            newItems.forEach((it: IFeedEntryItem) => {
              items.value.push(it)
            })
          }
          total.value = data.feedEntryCount
        }
      }
    },
    document: feedEntriesGQL,
    variables: () => ({
      offset: (page.value - 1) * limit,
      limit,
      query: q.value,
    }),
    appApi: true,
  })

  return {
    page,
    noMore,
    loading,
    fetch,
    loadMore: () => {
      if (noMore.value || loading.value) {
        return
      }
      page.value++
    },
  }
}

export const useTable = (items: Ref<IFeedEntryItem[]>, q: Ref<string>, total: Ref<number>, page: Ref<number>, limit: number) => {
  const { t } = useI18n()

  const { loading, fetch } = initLazyQuery({
    handle: (data: any, error: string) => {
      if (error) {
        toast(t(error), 'error')
      } else {
        if (data) {
          items.value = data.feedEntries.map((it: IFeedEntry) => ({ ...it, checked: false }))
          total.value = data.feedEntryCount
        }
      }
    },
    document: feedEntriesGQL,
    variables: () => ({
      offset: (page.value - 1) * limit,
      limit,
      query: q.value,
    }),
    appApi: true,
  })

  return {
    page,
    loading,
    fetch,
  }
}
