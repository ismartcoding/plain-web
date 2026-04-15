import { computed, ref, watch } from 'vue'
import toast from '@/components/toaster'
import { docsGQL, initLazyQuery } from '@/lib/api/query'
import { useRoute } from 'vue-router'
import { replacePath } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import { useTempStore } from '@/stores/temp'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import type { IDoc } from '@/lib/interfaces'
import { decodeBase64 } from '@/lib/strutil'
import { useSelectable } from '@/hooks/list'

export function useDocsData() {
  const mainStore = useMainStore()
  const { app } = storeToRefs(useTempStore())
  const { t } = useI18n()
  const { docSortBy } = storeToRefs(mainStore)
  const route = useRoute()
  const page = ref(parseInt(route.query.page?.toString() ?? '1'))
  const limit = computed(() => mainStore.pageSize)
  const q = ref('')
  const items = ref<IDoc[]>([])
  const isActive = ref(false)
  const sorting = ref(false)

  const selectable = useSelectable(items)

  const gotoPage = (p: number) => {
    const qVal = route.query.q
    replacePath(mainStore, qVal ? `/docs?page=${p}&q=${qVal}` : `/docs?page=${p}`)
  }

  function onChangePageSize(size: number) {
    mainStore.pageSize = size
    const qVal = route.query.q
    replacePath(mainStore, qVal ? `/docs?page=1&q=${qVal}` : `/docs?page=1`)
  }

  const { loading, fetch } = initLazyQuery({
    handle: (data: { items: IDoc[]; total: number }, error: string) => {
      sorting.value = false
      if (error) {
        toast(t(error), 'error')
      } else if (data) {
        items.value = data.items
        selectable.total.value = data.total
      }
    },
    document: docsGQL,
    variables: () => ({
      offset: (page.value - 1) * limit.value,
      limit: limit.value,
      query: q.value,
      sortBy: docSortBy.value,
    }),
  })

  function sort(value: string) {
    if (docSortBy.value === value) return
    sorting.value = true
    docSortBy.value = value
    gotoPage(1)
  }

  function applyRouteQuery() {
    if (!isActive.value) return
    page.value = parseInt(route.query.page?.toString() ?? '1')
    q.value = decodeBase64(route.query.q?.toString() ?? '')
    fetch()
  }

  watch(() => route.fullPath, () => { applyRouteQuery() })

  return {
    items, page, limit, q, loading, fetch, sorting, isActive,
    app, docSortBy, route,
    gotoPage, onChangePageSize, sort, applyRouteQuery,
    ...selectable,
  }
}
