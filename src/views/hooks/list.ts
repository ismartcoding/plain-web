import type { ISelectable } from '@/lib/interfaces'
import { computed, ref, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import toast from '@/components/toaster'
import { openModal } from '@/components/modal'
import DeleteItemsConfirm from '@/components/DeleteItemsConfirm.vue'
import type { DocumentNode } from 'graphql'
import type { MdCheckbox } from '@material/web/checkbox/checkbox'

export const useSelectable = (items: Ref<ISelectable[]>) => {
  const allChecked = ref(false)
  const realAllChecked = ref(false)
  const total = ref(0)

  return {
    realAllChecked,
    allChecked,
    toggleAllChecked: (e: Event) => {
      if ((e.target as MdCheckbox).checked) {
        allChecked.value = true
        items.value.forEach((it) => {
          it.checked = true
        })
      } else {
        allChecked.value = false
        realAllChecked.value = false
        items.value.forEach((it) => {
          it.checked = false
        })
      }
    },
    toggleItemChecked: (e: Event) => {
      if ((e.target as MdCheckbox).checked) {
        if (items.value.every((it) => it.checked)) {
          allChecked.value = true
        }
      } else {
        allChecked.value = false
        realAllChecked.value = false
      }
    },   
    toggleRow: (item: ISelectable) => {
      item.checked = !item.checked
      if (item.checked) {
        if (items.value.every((it) => it.checked)) {
          allChecked.value = true
        }
      } else {
        allChecked.value = false
        realAllChecked.value = false
      }
    },
    allCheckedAlertVisible: computed<boolean>(() => {
      return allChecked.value && !realAllChecked.value && items.value.length < total.value
    }),
    selectRealAll: () => {
      realAllChecked.value = true
    },
    clearSelection: () => {
      allChecked.value = false
      realAllChecked.value = false
      items.value.forEach((it) => {
        it.checked = false
      })
    },
    total,
    checked: computed<boolean>(() => {
      return items.value.some((it) => it.checked)
    }),
  }
}

export const useDelete = (gql: DocumentNode, done: () => void, items: Ref<ISelectable[]>) => {
  const { t } = useI18n()

  return {
    deleteItems: (realAllChecked: boolean, query: string) => {
      let q = query
      if (!realAllChecked) {
        const selectedItems = items.value.filter((it: ISelectable) => it.checked)
        if (selectedItems.length === 0) {
          toast(t('select_first'), 'error')
          return
        }
        q = `ids:${selectedItems.map((it: any) => it.id).join(',')}`
      }

      openModal(DeleteItemsConfirm, {
        gql: gql,
        variables: () => ({ query: q }),
        done: done,
      })
    },
  }
}
