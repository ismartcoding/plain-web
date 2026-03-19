import type { ComputedRef, Ref } from 'vue'
import { onMounted, onUnmounted } from 'vue'
import { useApolloClient } from '@vue/apollo-composable'
import { chatItemsGQL } from '@/lib/api/query'
import { insertCache } from '@/lib/api/mutation'
import { chatItemFragment } from '@/lib/api/fragments'
import type { IChatItem } from '@/lib/interfaces'
import emitter from '@/plugins/eventbus'

function normalizeItemData(item: any) {
  if (!item.data) return null
  const d = item.data
  d.__typename = d.type.split('.').pop()
  return d
}

export function useChatEvents(chatId: ComputedRef<string>, chatItems: Ref<IChatItem[]>, scrollBottom: () => void) {
  const { resolveClient } = useApolloClient()
  const handlers: Record<string, (...args: any[]) => any> = {}

  onMounted(() => {
    handlers.message_created = (data: any[]) => {
      const cache = resolveClient('a').cache
      const peerId = chatId.value.startsWith('peer:') ? chatId.value.slice(5) : ''
      const items = data
        .filter((item) => {
          const id = item.channelId ? `channel:${item.channelId}` : item.toId === 'local' ? 'local' : `peer:${item.toId}`
          return id === chatId.value || item.fromId === peerId
        })
        .map((item) => ({ ...item, data: normalizeItemData(item), __typename: 'ChatItem' }))
      if (!items.length) return
      const cached: any = cache.readQuery({ query: chatItemsGQL, variables: { id: chatId.value } })
      const existingIds = new Set((cached?.chatItems ?? []).map((i: any) => i.id))
      const newItems = items.filter((i) => !existingIds.has(i.id))
      if (newItems.length) { insertCache(cache, newItems, chatItemsGQL, { id: chatId.value }); scrollBottom() }
    }
    emitter.on('message_created', handlers.message_created)

    handlers.message_deleted = (data: string[]) => {
      const cache = resolveClient('a').cache
      for (const id of data) cache.evict({ id: cache.identify({ __typename: 'ChatItem', id }) })
    }
    emitter.on('message_deleted', handlers.message_deleted)

    handlers.message_cleared = (toId: string) => {
      const mapped = toId === 'local' ? 'local' : toId.startsWith('channel:') ? toId : `peer:${toId}`
      if (mapped !== chatId.value) return
      resolveClient('a').cache.writeQuery({ query: chatItemsGQL, variables: { id: chatId.value }, data: { chatItems: [] } })
      chatItems.value = []
    }
    emitter.on('message_cleared', handlers.message_cleared)

    handlers.message_updated = (items: any[]) => {
      const cache = resolveClient('a').cache
      for (const item of items) {
        const cacheId = cache.identify({ __typename: 'ChatItem', id: item.id })
        if (!cache.readFragment({ id: cacheId, fragment: chatItemFragment })) continue
        cache.writeFragment({ id: cacheId, fragment: chatItemFragment, data: { ...item, data: normalizeItemData(item) } })
        scrollBottom()
      }
    }
    emitter.on('message_updated', handlers.message_updated)
  })

  onUnmounted(() => {
    Object.entries(handlers).forEach(([event, fn]) => emitter.off(event as any, fn))
  })
}
