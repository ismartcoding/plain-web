import DeleteItemsConfirm from '@/components/DeleteItemsConfirm.vue'
import { openModal } from '@/components/modal'
import { useI18n } from 'vue-i18n'
import toast from '@/components/toaster'
import { deleteMediaItemsGQL } from '@/lib/api/mutation'
import emitter from '@/plugins/eventbus'
import DeleteConfirm from '@/components/DeleteConfirm.vue'
import type { DataType } from '@/lib/data'
import { encodeBase64 } from '@/lib/strutil'
import type { MainState } from '@/stores/main'
import { buildQuery } from '@/lib/search'
import { replacePath } from '@/plugins/router'
import type { IAudio, IBucket, IImageItem, ITag, IVideoItem } from '@/lib/interfaces'
import { ref } from 'vue'
import { bucketsTagsGQL, initLazyQuery } from '@/lib/api/query'

export const useDeleteItems = () => {
  const { t } = useI18n()
  const typeNameMap = new Map<string, string>()
  typeNameMap.set('AUDIO', 'Audio')
  typeNameMap.set('VIDEO', 'Video')
  typeNameMap.set('IMAGE', 'Image')

  return {
    deleteItems: (type: string, ids: string[], realAllChecked: boolean, total: number, query: string) => {
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
        count: realAllChecked ? total : ids.length,
        variables: () => ({ type: type, query: q }),
        done: () => {
          emitter.emit('media_items_actioned', { type: type, action: 'delete' })
        },
      })
    },

    deleteItem: (type: string, item: IImageItem | IVideoItem | IAudio) => {
      openModal(DeleteConfirm, {
        id: item.id,
        name: item.title,
        image: isIAudio(item) ? '' : item.fileId,
        gql: deleteMediaItemsGQL,
        variables: () => ({ type: type, query: `ids:${item.id}` }),
        appApi: true,
        typeName: typeNameMap.get(type) ?? '',
        done: () => {
          emitter.emit('media_items_actioned', { type: type, action: 'delete', id: item.id })
        },
      })
    },
  }
}

function isIAudio(object: any): object is IAudio {
  return 'albumFileId' in object
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

export const useBucketsTags = (type: DataType) => {
  const tags = ref<ITag[]>([])
  const buckets = ref<IBucket[]>([])
  const { t } = useI18n()
  const { fetch } = initLazyQuery({
    handle: async (data: { tags: ITag[]; mediaBuckets: IBucket[] }, error: string) => {
      if (error) {
        toast(t(error), 'error')
      } else {
        if (data) {
          tags.value = data.tags
          buckets.value = data.mediaBuckets
        }
      }
    },
    document: bucketsTagsGQL,
    variables: {
      type,
    },
    appApi: true,
  })

  return {
    tags,
    buckets,
    fetch,
  }
}
