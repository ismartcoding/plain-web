<template>
  <div id="console">
    <div class="toolbar">
      <span class="title"
        >{{ app?.deviceName ?? $t('my_phone')
        }}{{ app?.battery ? ' (' + $t('battery_left', { percentage: app?.battery }) + ')' : '' }}</span
      >
      <i-material-symbols:indeterminate-check-box-outline-rounded
        class="bi bi-btn"
        @click="() => (store.consoleOpen = false)"
      />
    </div>
    <div class="chat-items-container" ref="scrollContainer">
      <div>
        <div v-for="(chatItem, index) of chatItems" :key="chatItem.id" class="chat-item">
          <div class="date" v-if="dateVisible(chatItem, index)">{{ formatDate(chatItem.createdAt) }}</div>
          <popper>
            <div class="chat-title">
              <span class="name">{{ $t(chatItem.isMe ? 'me' : 'app_name') }}</span>
              <span class="time" :title="formatDateTimeFull(chatItem.createdAt)">{{
                formatTime(chatItem.createdAt)
              }}</span>
              <i-material-symbols:expand-more-rounded class="bi bi-more" />
            </div>
            <template #content>
              <ul class="menu-items">
                <li class="dropdown-item" @click="deleteMessage(chatItem.id)" :disabled="deleteLoading">
                  {{ $t('delete_message') }}
                </li>
              </ul>
            </template>
          </popper>
          <div class="chat-content">
            <div v-if="chatItem._content.type === 'text'">
              <pre>{{ chatItem._content.value.text }}</pre>
            </div>
            <component v-else :is="getComponent(chatItem._content.type)" :data="chatItem"></component>
          </div>
        </div>
      </div>
    </div>
    <div class="chat-input">
      <textarea
        v-model="chatText"
        autocomplete="off"
        class="form-control"
        :placeholder="$t('chat_input_hint')"
        @keydown.enter.exact.prevent="send"
        @keydown.enter.shift.exact.prevent="chatText += '\n'"
      ></textarea>
      <i class="bi bi-btn" @click="send" :disable="createLoading">
        <i-material-symbols:send-outline-rounded />
      </i>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useMainStore } from '@/stores/main'
import { formatTime, formatDateTimeFull, formatDate } from '@/lib/format'
import ChatImages from './chat/ChatImages.vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { createChatItemGQL, deleteChatItemGQL, initMutation, updateCache } from '@/lib/api/mutation'
import { chatItemsGQL, initQuery } from '@/lib/api/query'
import toast from './toaster'
import { nextTick, onMounted, ref } from 'vue'
import type { ApolloCache } from '@apollo/client/core'
import { useTempStore } from '@/stores/temp'
import type { IChatItem } from '@/lib/interfaces'
import ChatFiles from './chat/ChatFiles.vue'
import { useApolloClient } from '@vue/apollo-composable'
import emitter from '@/plugins/eventbus'
import { chatItemFragment } from '@/lib/api/fragments'

const { resolveClient } = useApolloClient()
const scrollContainer = ref<HTMLDivElement>()
const chatItems = ref<IChatItem[]>([])

const { app } = storeToRefs(useTempStore())

const deleteId = ref('')
const { t } = useI18n()
let initialized = false

function dateVisible(item: IChatItem, index: number): boolean {
  let visible = false
  if (index == 0) {
    visible = true
  } else {
    const prev = index > 0 ? chatItems.value[index - 1] : null
    if (prev != null && formatDate(prev.createdAt) !== formatDate(item.createdAt)) {
      visible = true
    }
  }

  return visible
}

initQuery({
  handle: async (data: any, error: string) => {
    if (error) {
      toast(t(error), 'error')
    } else {
      if (data) {
        chatItems.value = data.chatItems
        if (!initialized) {
          await nextTick()
          scrollBottom()
          initialized = true
        }
      }
    }
  },
  document: chatItemsGQL,
  appApi: true,
})

function getComponent(type: string) {
  return {
    images: ChatImages,
    files: ChatFiles,
  }[type]
}
const store = useMainStore()

const { chatText } = storeToRefs(store)

const {
  mutate: create,
  loading: createLoading,
  onDone: createDone,
} = initMutation({
  document: createChatItemGQL,
  options: {
    update: (cache: ApolloCache<any>, data: any) => {
      updateCache(cache, data.data.createChatItem, chatItemsGQL)
    },
  },
  appApi: true,
})

function send() {
  if (!chatText.value) {
    return
  }
  create({ message: chatText.value })
}

function scrollBottom() {
  const div = scrollContainer.value
  if (div) {
    div.scrollTop = div.scrollHeight
  }
}

createDone(() => {
  chatText.value = ''
  scrollBottom()
})

const { mutate: deleteItem, loading: deleteLoading } = initMutation({
  document: deleteChatItemGQL,
  options: {
    update: (cache: ApolloCache<any>) => {
      cache.evict({ id: cache.identify({ __typename: 'ChatItem', id: deleteId.value }) })
    },
  },
  appApi: true,
})

function deleteMessage(id: string) {
  deleteId.value = id
  deleteItem({ id })
}

onMounted(() => {
  emitter.on('message_created', async (data: any[]) => {
    const client = resolveClient('a')
    const items = []
    for (const item of data) {
      let data = null
      if (item.data) {
        data = item.data
        data.__typename =  item.data.type.split('.').pop()
      }
      items.push({ ...item, data: data, __typename: 'ChatItem' })
    }
    updateCache(client.cache, items, chatItemsGQL)
  })
  
  emitter.on('message_deleted', async (data: string[]) => {
    const client = resolveClient('a')
    const cache = client.cache
    for (const id of data) {
      cache.evict({ id: cache.identify({ __typename: 'ChatItem', id: id }) })
    }
  })

  emitter.on('message_updated', async (data: any[]) => {
    const client = resolveClient('a')
    const cache = client.cache
    for (const item of data) {
      const id = item.id
      const cacheId = cache.identify({ __typename: 'ChatItem', id: id })
      const fragment = chatItemFragment
      const data = cache.readFragment({ id: cacheId, fragment })
      if (data) {
        cache.writeFragment({
          id: cacheId,
          fragment,
          data: {
            ...data,
            ...item,
          },
        })
      }
    }
  })
})
</script>

<style lang="scss" scoped>
#console {
  width: 280px;
  border-left: 1px solid var(--border-color);
  flex: 0 0 auto;
  display: flex;
  background: var(--back-color);
  flex-flow: column;
  height: 100vh;
}

.toolbar {
  height: 44px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 16px;
  flex: 0 0 auto;

  .title {
    font-size: 0.875rem;
    text-overflow: ellipsis;
  }
}

.chat-input {
  border-top: 1px solid var(--border-color);
  display: flex;
  flex: 0 0 auto;

  .form-control {
    border: none;
  }

  .bi {
    margin: 12px;
  }

  textarea {
    resize: none;
  }
}

.chat-items-container {
  overflow-y: scroll;
  display: flex;
  flex: 1 1 auto;

  & > div {
    width: 100%;
  }
}

.chat-content {
  margin-top: 8px;
}
</style>
