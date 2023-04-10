import type { ISelectable } from '@/lib/interfaces'
import { ref, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import toast from '@/components/toaster'
import { openModal } from '@/components/modal'
import DeleteItemsConfirm from '@/components/DeleteItemsConfirm.vue'
import type { DocumentNode } from 'graphql'

export const useSelectable = (items: Ref<ISelectable[]>) => {
  const selectAll = ref(false)

  function toggleSelect() {
    if (selectAll.value) {
      items.value.forEach((it) => {
        it.checked = true
      })
    } else {
      items.value.forEach((it) => {
        it.checked = false
      })
    }
  }

  return {
    selectAll,
    toggleSelect,
  }
}

export const useDelete = (gql: DocumentNode, done: () => void, items: Ref<ISelectable[]>) => {
  const { t } = useI18n()

  return {
    deleteItems: () => {
      const selectedItems = items.value.filter((it: ISelectable) => it.checked)
      if (selectedItems.length === 0) {
        toast(t('select_first'), 'error')
        return
      }

      openModal(DeleteItemsConfirm, {
        gql: gql,
        variables: () => ({ ids: selectedItems.map((it: any) => it.id) }),
        done: done,
      })
    },
  }
}
