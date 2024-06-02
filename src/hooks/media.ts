import DeleteItemsConfirm from '@/components/DeleteItemsConfirm.vue'
import { openModal } from '@/components/modal'
import { useI18n } from 'vue-i18n'
import toast from '@/components/toaster'
import type { IFilter, IMediaItem, ISelectable, ITag } from '@/lib/interfaces'
import { deleteMediaItemsGQL } from '@/lib/api/mutation'
import emitter from '@/plugins/eventbus'
import DeleteConfirm from '@/components/DeleteConfirm.vue'
import { parseQuery } from '@/lib/search'

export const useDeleteItems = () => {
  const { t } = useI18n()
  const typeNameMap = new Map<string, string>()
  typeNameMap.set('AUDIO', 'Audio')
  typeNameMap.set('VIDEO', 'Video')
  typeNameMap.set('IMAGE', 'Image')

  return {
    deleteItems: (type: string, items: IMediaItem[], realAllChecked: boolean, query: string) => {
      let q = query
      if (!realAllChecked) {
        const selectedItems = items.filter((it: ISelectable) => it.checked)
        if (selectedItems.length === 0) {
          toast(t('select_first'), 'error')
          return
        }
        q = `ids:${selectedItems.map((it: IMediaItem) => it.id).join(',')}`
      }

      openModal(DeleteItemsConfirm, {
        gql: deleteMediaItemsGQL,
        variables: () => ({ type: type, query: q }),
        done: () => {
          emitter.emit('media_items_deleted', { type: type })
        },
      })
    },

    deleteItem: (type: string, item: IMediaItem) => {
      openModal(DeleteConfirm, {
        id: item.id,
        name: item.title,
        gql: deleteMediaItemsGQL,
        variables: () => ({ type: type, query: `ids:${item.id}` }),
        appApi: true,
        typeName: typeNameMap.get(type) ?? '',
        done: () => {
          emitter.emit('media_item_deleted', { item, type })
        },
      })
    },
  }
}
