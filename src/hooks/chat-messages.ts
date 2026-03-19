import { ref, reactive, watch, type ComputedRef, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useApolloClient } from '@vue/apollo-composable'
import type { ApolloCache } from '@apollo/client/core'
import { initQuery, chatItemsGQL } from '@/lib/api/query'
import { sendChatItemGQL, deleteChatItemGQL, initMutation, insertCache } from '@/lib/api/mutation'
import toast from '@/components/toaster'
import type { IChatItem } from '@/lib/interfaces'
import { shortUUID } from '@/lib/strutil'
import { useTasks } from '@/hooks/chat'
import { useChatEvents } from '@/hooks/chat-events'

export function useChatMessages(chatId: ComputedRef<string>, channelId: ComputedRef<string>) {
  const { t } = useI18n()
  const scrollContainer = ref<HTMLDivElement>()
  const chatItems = ref<IChatItem[]>([])
  const menuVisible = reactive<Record<string, boolean>>({})
  const { cancel: cancelTask } = useTasks()
  const deleteId = ref('')
  let initialized = false

  function scrollBottom() {
    const div = scrollContainer.value
    if (!div) return
    setTimeout(() => { div.scrollTop = div.scrollHeight }, 100)
  }

  const { loading, refetch } = initQuery({
    handle: async (data: any, error: string) => {
      if (error) {
        toast(t(error), 'error')
      } else if (data) {
        chatItems.value = data.chatItems
        if (!initialized) { scrollBottom(); initialized = true }
      }
    },
    document: chatItemsGQL,
    variables: () => ({ id: chatId.value }),
  })

  const { mutate: sendMutate, loading: sendLoading, onDone: sendDone } = initMutation({
    document: sendChatItemGQL,
    options: {
      update: (cache: ApolloCache<any>, data: any) => {
        insertCache(cache, data.data.sendChatItem, chatItemsGQL, { id: chatId.value })
      },
    },
  })
  sendDone(() => scrollBottom())

  const { mutate: deleteItem, loading: deleteLoading } = initMutation({
    document: deleteChatItemGQL,
    options: {
      update: (cache: ApolloCache<any>) => {
        cache.evict({ id: cache.identify({ __typename: 'ChatItem', id: deleteId.value }) })
      },
    },
  })

  function send(chatText: Ref<string>) {
    if (!chatText.value) return
    const tempId = 'new_' + shortUUID()
    const tempItem: IChatItem = {
      id: tempId, fromId: 'me', toId: chatId.value, channelId: channelId.value,
      createdAt: new Date().toISOString(),
      content: JSON.stringify({ type: 'text', value: { text: chatText.value } }),
      _content: { type: 'text', value: { text: chatText.value } },
      __typename: 'ChatItem',
      data: { __typename: 'MessageText', ids: [] },
    }
    chatItems.value = [...chatItems.value, tempItem]
    chatText.value = ''
    scrollBottom()
    sendMutate({ toId: chatId.value, content: tempItem.content }).then(() => {
      chatItems.value = chatItems.value.filter((i) => i.id !== tempId)
    })
  }

  function deleteMessage(id: string) {
    deleteId.value = id
    deleteItem({ id })
    cancelTask(id)
  }

  async function clearMessages() {
    const ids = chatItems.value.filter((i) => !i.id.startsWith('new_')).map((i) => i.id)
    for (const id of ids) {
      cancelTask(id)
      deleteId.value = id
      await deleteItem({ id })
    }
  }

  // Real-time event bus handlers for message CRUD
  useChatEvents(chatId, chatItems, scrollBottom)

  watch(chatId, () => { initialized = false; chatItems.value = []; refetch(); scrollBottom() })

  return {
    chatItems, loading, sendLoading, deleteLoading, menuVisible,
    scrollContainer, scrollBottom,
    send, deleteMessage, clearMessages, refetch,
  }
}
