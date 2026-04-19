import type { ComputedRef, Ref } from 'vue'
import { onActivated, onDeactivated } from 'vue'
import type { IChatItem } from '@/lib/interfaces'
import emitter from '@/plugins/eventbus'

/** Replicate Apollo's ChatItem._content field: parse the JSON content string. */
export function normalizeChatItem(item: any): IChatItem {
  return {
    ...item,
    _content: item._content ?? (item.content ? JSON.parse(item.content) : null),
    __typename: 'ChatItem',
  }
}

export function useChatEvents(chatId: ComputedRef<string>, chatItems: Ref<IChatItem[]>, scrollBottom: () => void) {
  const handlers: Record<string, (...args: any[]) => any> = {}

  onActivated(() => {
    handlers.message_created = (data: any[]) => {
      const peerId = chatId.value.startsWith('peer:') ? chatId.value.slice(5) : ''
      const items = data
        .filter((item) => {
          const id = item.channelId ? `channel:${item.channelId}` : item.toId === 'local' ? 'local' : `peer:${item.toId}`
          return id === chatId.value || item.fromId === peerId
        })
        .map(normalizeChatItem)
      if (!items.length) return
      const existingIds = new Set(chatItems.value.map((i: any) => i.id))
      const newItems = items.filter((i) => !existingIds.has(i.id))
      if (newItems.length) { chatItems.value = [...chatItems.value, ...newItems]; scrollBottom() }
    }
    emitter.on('message_created', handlers.message_created)

    handlers.message_deleted = (data: string[]) => {
      const idSet = new Set(data)
      chatItems.value = chatItems.value.filter((i) => !idSet.has(i.id))
    }
    emitter.on('message_deleted', handlers.message_deleted)

    handlers.message_cleared = (toId: string) => {
      const mapped = toId === 'local' ? 'local' : toId.startsWith('channel:') ? toId : `peer:${toId}`
      if (mapped !== chatId.value) return
      chatItems.value = []
    }
    emitter.on('message_cleared', handlers.message_cleared)

    handlers.message_updated = (items: any[]) => {
      const updateMap = new Map(items.map((item) => [item.id, normalizeChatItem(item)]))
      chatItems.value = chatItems.value.map((i) => updateMap.has(i.id) ? { ...i, ...updateMap.get(i.id)! } : i)
      if (updateMap.size) scrollBottom()
    }
    emitter.on('message_updated', handlers.message_updated)
  })

  onDeactivated(() => {
    Object.entries(handlers).forEach(([event, fn]) => emitter.off(event as any, fn))
  })
}
