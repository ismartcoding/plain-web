import type { ITag } from '@/lib/interfaces'
import { ref, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import toast from '@/components/toaster'
import { openModal } from '@/components/modal'
import AddToTagsModal from '@/components/AddToTagsModal.vue'
import { initLazyQuery, tagsGQL } from '@/lib/api/query'

export const useAddToTags = (type: string, tags: Ref<ITag[]>) => {
  const { t } = useI18n()

  return {
    addToTags: (ids: string[], realAllChecked: boolean, query: string) => {
      let q = query
      if (!realAllChecked) {
        if (ids.length === 0) {
          toast(t('select_first'), 'error')
          return
        }
        q = `ids:${ids.join(',')}`
      }

      openModal(AddToTagsModal, {
        type,
        tags: tags.value,
        query: q,
      })
    },
  }
}

export const useTags = (type: string, onLoad: () => void = () => {}) => {
  const tags = ref<ITag[]>([])
  const { t } = useI18n()

  const { loading, fetch } = initLazyQuery({
    handle: async (data: any, error: string) => {
      if (error) {
        toast(t(error), 'error')
      } else {
        if (data) {
          tags.value = data.tags
          onLoad()
        }
      }
    },
    document: tagsGQL,
    variables: {
      type: type,
    },
    appApi: true,
  })
  return {
    tags,
    loading,
    fetch,
  }
}
