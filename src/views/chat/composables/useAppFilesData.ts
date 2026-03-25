import { ref } from 'vue'
import { appFilesGQL, initLazyQuery } from '@/lib/api/query'
import toast from '@/components/toaster'
import { useI18n } from 'vue-i18n'

export interface IAppFile {
  id: string
  size: number
  mimeType: string
  fileName: string
  createdAt: string
  updatedAt: string
}

const PAGE_SIZE = 50

export function useAppFilesData() {
  const { t } = useI18n()

  const items = ref<IAppFile[]>([])
  const total = ref(0)
  const page = ref(1)
  const noMore = ref(false)
  const firstInit = ref(true)

  const { loading, fetch } = initLazyQuery({
    handle: (data: { appFiles: IAppFile[]; appFileCount: number }, error: string) => {
      firstInit.value = false
      if (error) {
        toast(t(error), 'error')
      } else if (data) {
        const newItems = data.appFiles ?? []
        if (page.value > 1) {
          items.value = items.value.concat(newItems)
        } else {
          items.value = newItems
        }
        total.value = data.appFileCount
        noMore.value = newItems.length < PAGE_SIZE
      }
    },
    document: appFilesGQL,
    variables: () => ({
      offset: (page.value - 1) * PAGE_SIZE,
      limit: PAGE_SIZE,
    }),
    options: { fetchPolicy: 'no-cache' },
  })

  function loadMore() {
    if (noMore.value || loading.value) return
    page.value++
    fetch()
  }

  function refresh() {
    page.value = 1
    noMore.value = false
    fetch()
  }

  return { items, total, loading, firstInit, noMore, fetch, loadMore, refresh }
}
