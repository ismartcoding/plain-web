import DeleteItemsConfirm from '@/components/DeleteItemsConfirm.vue'
import { openModal } from '@/components/modal'
import { useI18n } from 'vue-i18n'
import toast from '@/components/toaster'
import type { ISelectable } from '@/lib/interfaces'
import type { Ref } from 'vue'
import { deleteMediaItemsGQL, initMutation, setTempValueGQL } from '@/lib/api/mutation'
import emitter from '@/plugins/eventbus'
import { shortUUID } from '@/lib/strutil'
import { getApiBaseUrl } from '@/lib/api/api'
import { download } from '@/lib/api/file'

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

export const useDownloadItems = (items: Ref<ISelectable[]>) => {
  const { t } = useI18n()

  const { mutate: setTempValue, onDone: setTempValueDone } = initMutation({
    document: setTempValueGQL,
    appApi: true,
  })

  setTempValueDone((r: any) => {
    const url = `${getApiBaseUrl()}/zip/files?id=${encodeURIComponent(r.data.setTempValue.key)}`
    download(url, '')
    items.value.forEach((it: ISelectable) => {
      it.checked = false
    })
  })

  return {
    downloadItems: () => {
      const selectedItems = items.value.filter((it: ISelectable) => it.checked)
      if (selectedItems.length === 0) {
        toast(t('select_first'), 'error')
        return
      }

      setTempValue({ key: shortUUID(), value: JSON.stringify(selectedItems.map((it: any) => it.path)) })
    },
  }
}

