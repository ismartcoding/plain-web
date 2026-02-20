// use upload queue instead of calling upload directly
import { addUploadTask } from '@/lib/upload/upload-queue'
import { sendChatItemGQL, insertCache } from '@/lib/api/mutation'
import type { IChatItem } from '@/lib/interfaces'
import type { IUploadItem } from '@/stores/temp'
import apollo from '@/plugins/apollo'
import { chatItemsGQL } from '@/lib/api/query'
import emitter from '@/plugins/eventbus'

interface IChatTask {
  uploads: IUploadItem[]
  item: IChatItem
  toId: string
}

export const useTasks = () => {
  // Active tasks keyed by message id
  const activeTasks: Map<string, IChatTask> = new Map()
  const finalized: Set<string> = new Set()
  let subscribed = false

  const tryFinalize = async (task: IChatTask) => {
    if (finalized.has(task.item.id)) return
    const allDone = task.uploads.every((u) => u.status === 'done' || u.status === 'error')
    if (!allDone) return

    finalized.add(task.item.id)
    activeTasks.delete(task.item.id)

    const c = task.item._content
    const items: any[] = []
    c.value.items.forEach((it: any, index: number) => {
      const fileName = task.uploads[index].fileName
      items.push({
        uri: it.isAppDir ? `app://` + fileName : it.dir + '/' + fileName,
        size: it.size,
        duration: it.duration,
        width: it.width,
        height: it.height,
        summary: it.summary,
        fileName: fileName,
      })
    })

    const res = await apollo.a.mutate({ mutation: sendChatItemGQL, variables: { toId: task.toId, content: JSON.stringify({ type: c.type, value: { items } }) } })
    const cache = apollo.a.cache
    cache.evict({ id: cache.identify({ __typename: 'ChatItem', id: task.item.id }) })
    if (res?.data?.sendChatItem) {
      insertCache(cache, res.data.sendChatItem, chatItemsGQL, { id: task.toId })
    }
  }

  const ensureSubscribed = () => {
    if (subscribed) return
    // finalize on success event
    emitter.on('upload_task_done', (u: IUploadItem) => {
      for (const task of activeTasks.values()) {
        if (task.uploads.some((it) => it.id === u.id)) {
          tryFinalize(task)
          break
        }
      }
    })
    // also react to progress/error to avoid waiting forever
    emitter.on('upload_progress', (u: IUploadItem) => {
      for (const task of activeTasks.values()) {
        if (task.uploads.some((it) => it.id === u.id)) {
          tryFinalize(task)
          break
        }
      }
    })
    subscribed = true
  }

  return {
    async enqueue(item: IChatItem, uploads: IUploadItem[], toId: string) {
      ensureSubscribed()
      const task: IChatTask = { item, uploads, toId }
      activeTasks.set(item.id, task)
      // start all uploads immediately; concurrency is controlled by upload-queue (maxConcurrent)
      uploads.forEach((u) => addUploadTask(u, false))
      // in case some finished synchronously, try finalize now
      await tryFinalize(task)
    },
    cancel(messageId: string) {
      finalized.add(messageId)
      activeTasks.delete(messageId)
    },
  }
}
