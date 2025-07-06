import { upload } from '@/lib/upload/upload'
import { createChatItemGQL, initMutation, insertCache } from '@/lib/api/mutation'
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
        insertCache(cache, data.data.createChatItem, chatItemsGQL, { id: 'local' })
        signalEnd()
      },
    },
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
        const fileName = pending!.uploads[index].fileName
        items.push({
          uri: it.isAppDir ? `app://` + fileName : it.dir + '/' + fileName,
          size: it.size,
          duration: it.duration,
          width: it.width,
          height: it.height,
          summary: it.summary,
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
