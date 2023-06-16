import DeleteItemsConfirm from '@/components/DeleteItemsConfirm.vue'
import { openModal } from '@/components/modal'
import { useI18n } from 'vue-i18n'
import toast from '@/components/toaster'
import type { ISelectable } from '@/lib/interfaces'
import type { Ref } from 'vue'
import { deleteMediaItemsGQL } from '@/lib/api/mutation'
import emitter from '@/plugins/eventbus'

export const useDeleteItems = (tagType: string, items: Ref<ISelectable[]>) => {
  const { t } = useI18n()

  return {
    deleteItems: () => {
      const selectedItems = items.value.filter((it: ISelectable) => it.checked)
      if (selectedItems.length === 0) {
        toast(t('select_first'), 'error')
        return
      }

      openModal(DeleteItemsConfirm, {
        gql: deleteMediaItemsGQL,
        variables: () => ({ tagType: tagType, ids: selectedItems.map((it: any) => it.id) }),
        done: () => {
          emitter.emit('refetch_app')
          emitter.emit('refetch_by_tag_type', tagType)
        },
      })
    },
  }
}
