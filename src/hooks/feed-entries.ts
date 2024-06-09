import { feedEntriesGQL, initLazyQuery } from '@/lib/api/query'
import type { IFeedEntry } from '@/lib/interfaces'
import { ref, type Ref } from 'vue'
import toast from '@/components/toaster'
import { useI18n } from 'vue-i18n'

export const useList = (items: Ref<IFeedEntry[]>, q: Ref<string>, total: Ref<number>) => {
  const { t } = useI18n()

  const page = ref(1)
  const limit = 50
  const noMore = ref(false)
  const { loading, fetch } = initLazyQuery({
    handle: (data: { items: IFeedEntry[]; count: number }, error: string) => {
      if (error) {
        toast(t(error), 'error')
      } else {
        if (data) {
          if (data.items.length < limit) {
            noMore.value = true
          }
          const newItems = data.items
          if (page.value === 1) {
            items.value = newItems
          } else {
            items.value = items.value.concat(newItems)
          }
          total.value = data.total
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

export const useTable = (items: Ref<IFeedEntry[]>, q: Ref<string>, total: Ref<number>, page: Ref<number>, limit: number) => {
  const { t } = useI18n()

  const { loading, fetch } = initLazyQuery({
    handle: (data: { items: IFeedEntry[]; total: number }, error: string) => {
      if (error) {
        toast(t(error), 'error')
      } else {
        if (data) {
          items.value = data.items
          total.value = data.total
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
