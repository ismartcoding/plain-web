import type { IFilter, ISelectable, ITag } from '@/lib/interfaces'
import { ref, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import toast from '@/components/toaster'
import { openModal } from '@/components/modal'
import AddToTagsModal from '@/components/AddToTagsModal.vue'
import RemoveFromTagsModal from '@/components/RemoveFromTagsModal.vue'
import { initQuery, tagsGQL } from '@/lib/api/query'
import { parseQuery, type IFilterField } from '@/lib/search'
import { kebabCase } from 'lodash-es'

export const useAddToTags = (tagType: string, items: Ref<ISelectable[]>, tags: Ref<ITag[]>) => {
  const { t } = useI18n()

  return {
    addToTags: () => {
      const selectedItems = items.value.filter((it: ISelectable) => it.checked)
      if (selectedItems.length === 0) {
        toast(t('select_first'), 'error')
        return
      }

      openModal(AddToTagsModal, {
        tagType,
        tags: tags.value,
        items: selectedItems.map((it: any) => ({
          key: it.id,
          title: it.title,
          size: it.size,
        })),
      })
    },
  }
}

export const useRemoveFromTags = (tagType: string, items: Ref<ISelectable[]>, tags: Ref<ITag[]>) => {
  const { t } = useI18n()

  return {
    removeFromTags: () => {
      const selectedItems = items.value.filter((it: ISelectable) => it.checked)
      if (selectedItems.length === 0) {
        toast(t('select_first'), 'error')
        return
      }

      openModal(RemoveFromTagsModal, {
        tagType,
        tags: tags.value,
        ids: selectedItems.map((it: any) => it.id),
      })
    },
  }
}

export const useTags = (tagType: string, q: Ref<string>, filter: IFilter, onLoad: (fields: IFilterField[]) => void) => {
  const tags = ref<ITag[]>([])
  const { t } = useI18n()

  initQuery({
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
      type: tagType,
    },
    appApi: true,
  })
  return {
    tags,
  }
}
