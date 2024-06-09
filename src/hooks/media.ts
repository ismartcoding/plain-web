import DeleteItemsConfirm from '@/components/DeleteItemsConfirm.vue'
import { openModal } from '@/components/modal'
import { useI18n } from 'vue-i18n'
import toast from '@/components/toaster'
import type { IBucket, IMedia } from '@/lib/interfaces'
import { deleteMediaItemsGQL } from '@/lib/api/mutation'
import emitter from '@/plugins/eventbus'
import DeleteConfirm from '@/components/DeleteConfirm.vue'
import type { DataType } from '@/lib/data'
import { encodeBase64 } from '@/lib/strutil'
import type { MainState } from '@/stores/main'
import { buildQuery } from '@/lib/search'
import router, { replacePath } from '@/plugins/router'

export const useDeleteItems = () => {
  const { t } = useI18n()
  const typeNameMap = new Map<string, string>()
  typeNameMap.set('AUDIO', 'Audio')
  typeNameMap.set('VIDEO', 'Video')
  typeNameMap.set('IMAGE', 'Image')

  return {
    deleteItems: (type: string, ids: string[], realAllChecked: boolean, query: string) => {
      let q = query
      if (!realAllChecked) {
        if (ids.length === 0) {
          toast(t('select_first'), 'error')
          return
        }
        q = `ids:${ids.join(',')}`
      }

      openModal(DeleteItemsConfirm, {
        gql: deleteMediaItemsGQL,
        variables: () => ({ type: type, query: q }),
        done: () => {
          emitter.emit('media_items_deleted', { type: type })
        },
      })
    },

    deleteItem: (type: string, item: IMedia) => {
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

export const useBuckets = (type: DataType) => {
  const path = {
    AUDIO: 'audios',
    IMAGE: 'images',
    VIDEO: 'videos',
  }[type]
  return {
    view(mainStore: MainState, id: string) {
      const q = buildQuery([
        {
          name: 'bucket_id',
          op: '',
          value: id,
        },
      ])
      replacePath(mainStore, `/${path}?q=${encodeBase64(q)}`)
    },
  }
}
