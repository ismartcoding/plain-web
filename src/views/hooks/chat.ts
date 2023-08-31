import { upload } from '@/lib/api/file'
import { createChatItemGQL, initMutation, updateCache } from '@/lib/api/mutation'
import type { IChatItem } from '@/lib/interfaces'
import type { IUploadItem } from '@/stores/temp'
import type { ApolloCache } from '@apollo/client/core'
import { chunk } from 'lodash-es'
import { getFileDir } from './files'
import { chatItemsGQL } from '@/lib/api/query'

interface IChatTask {
  uploads: IUploadItem[]
  item: IChatItem
}

export const useTasks = () => {
  const tasks: IChatTask[] = [] // send message tasks
  let pending: IChatTask | null = null

  const { mutate } = initMutation({
    document: createChatItemGQL,
    options: {
      update: (cache: ApolloCache<any>, data: any) => {
        cache.evict({ id: cache.identify({ __typename: 'ChatItem', id: pending?.item.id }) })
        updateCache(cache, data.data.createChatItem, chatItemsGQL)
        signalEnd()
      },
    },
    appApi: true,
  })

  const signalEnd = () => {
    pending = null
    if (tasks.length) {
      doNext()
    }
  }

  const doNext = async () => {
    if (pending) {
      return
    }

    pending = tasks.shift() || null
    if (pending) {
      const chunked = chunk(pending.uploads, 5)
      for (const it of chunked) {
        await Promise.all(
          it.map(async (item) => {
            await upload(item, false)
          })
        )
      }

      const c = pending.item._content
      const items: any[] = []
      c.value.items.forEach((it: any, index: number) => {
        const dir = getFileDir(it.uri)
        items.push({
          uri: `app://${dir}/` + pending!.uploads[index].fileName,
          size: it.size,
          duration: it.duration,
        })
      })
      mutate({ content: JSON.stringify({ type: c.type, value: { items } }) })
    }
  }

  return {
    async enqueue(item: IChatItem, uploads: IUploadItem[]) {
      tasks.push({ item, uploads })
      if (pending == null) {
        await doNext()
      }
    },
  }
}
