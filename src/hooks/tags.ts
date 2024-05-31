import type { IFilter, ISelectable, ITag } from '@/lib/interfaces'
import { ref, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import toast from '@/components/toaster'
import { openModal } from '@/components/modal'
import AddToTagsModal from '@/components/AddToTagsModal.vue'
import { initLazyQuery, tagsGQL } from '@/lib/api/query'
import { parseQuery, type IFilterField } from '@/lib/search'
import { kebabCase } from 'lodash-es'

export const useAddToTags = (type: string, items: Ref<ISelectable[]>, tags: Ref<ITag[]>) => {
  const { t } = useI18n()

  return {
    addToTags: (realAllChecked: boolean, query: string) => {
      let q = query
      if (!realAllChecked) {
        const selectedItems = items.value.filter((it: ISelectable) => it.checked)
        if (selectedItems.length === 0) {
          toast(t('select_first'), 'error')
          return
        }
        q = `ids:${selectedItems.map((it: any) => it.id).join(',')}`
      }

      openModal(AddToTagsModal, {
        type,
        tags: tags.value,
        query: q,
      })
    },
  }
}

export const useTags = (type: string, q: Ref<string>, filter: IFilter, onLoad: (fields: IFilterField[]) => void) => {
  const tags = ref<ITag[]>([])
  const { t } = useI18n()

  const { loading, load, refetch } = initLazyQuery({
    handle: async (data: any, error: string) => {
      if (error) {
        toast(t(error), 'error')
      } else {
        if (data) {
          tags.value = data.tags
          const fields = parseQuery(q.value as string)
          filter.tags = []
          const tagIds: string[] = []
          fields.forEach((it) => {
            if (it.name === 'text') {
              filter.text = it.value
            } else if (it.name === 'tag') {
              const tag = data.tags.find((t: ITag) => kebabCase(t.name) === it.value)
              if (tag) {
                filter.tags.push(tag)
                tagIds.push(tag.id)
              } else {
                tagIds.push('invalid')
              }
            } else if (it.name === 'bucket_id') {
              filter.bucketId = it.value
            }
          })
          const newFields = [...fields].filter((it) => it.name !== 'tag')
          tagIds.forEach((it) => {
            newFields.push({
              name: 'tag_id',
              op: '',
              value: it,
            })
          })

          onLoad(newFields)
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
    load,
    refetch,
  }
}
