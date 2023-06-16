<template>
  <div class="page-container container">
    <div class="main">
      <splitpanes class="chat-container" horizontal>
        <pane size="80">
          <div class="chat-items" ref="scrollContainer">
            <div v-for="(item, index) in chats" :key="item.id" class="chat-item">
              <div class="date" v-if="dateVisible(item, index)">{{ formatDate(item.createdAt) }}</div>
              <popper v-if="index > 0">
                <div class="chat-title">
                  <span class="name">{{ $t(item.isMe ? 'me' : 'ai') }}</span>
                  <span class="time" :title="formatDateTimeFull(item.createdAt)">{{ formatTime(item.createdAt) }}</span>
                </div>
                <template #content>
                  <ul class="menu-items">
                    <li class="dropdown-item" @click="deleteMessage(item.id)" :disabled="deleteLoading">
                      {{ $t('delete_message') }}
                    </li>
                  </ul>
                </template>
              </popper>
              <div v-else class="chat-title">
                <span class="name">{{ $t(item.isMe ? 'me' : 'ai') }}</span>
                <span class="time" :title="formatDateTimeFull(item.createdAt)">{{ formatTime(item.createdAt) }}</span>
              </div>
              <div class="chat-content md-container" v-html="item.md"></div>
            </div>
            <div v-if="replying" class="chat-item replying">
              <div class="chat-title">
                <span class="name">{{ $t('ai') }}</span>
              </div>
              <div class="chat-content md-container" v-html="replyingContentMD"></div>
            </div>
          </div>
        </pane>
        <pane class="chat-input" size="10" min-size="5">
          <textarea
            v-model="content"
            class="form-control"
            autocomplete="off"
            :placeholder="$t('chat_input_hint')"
            @keydown.enter.exact.prevent="send"
            @keydown.enter.shift.exact.prevent="content += '\n'"
          ></textarea>
          <i class="bi bi-btn" @click.stop="send">
            <i-material-symbols:send-outline-rounded />
          </i>
        </pane>
      </splitpanes>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Splitpanes, Pane } from 'splitpanes'
import { useRoute } from 'vue-router'
import { nextTick, onMounted, ref } from 'vue'
import toast from '@/components/toaster'
import { useI18n } from 'vue-i18n'
import { aichatDetailGQL, initQuery } from '@/lib/api/query'
import type { IAIChat } from '@/lib/interfaces'
import { useMainStore } from '@/stores/main'
import { useTempStore } from '@/stores/temp'
import { storeToRefs } from 'pinia'
import { createAIChatGQL, deleteAIChatItemsGQL, initMutation } from '@/lib/api/mutation'
import { replacePathNoReload } from '@/plugins/router'
import { formatTime, formatDateTimeFull, formatDate } from '@/lib/format'
import type { ApolloCache } from '@apollo/client/cache'
import emitter from '@/plugins/eventbus'
import { useMarkdown } from './hooks/markdown'

const mainStore = useMainStore()

const { t } = useI18n()

const route = useRoute()
const id = ref(route.params.id)
const content = ref('')
const chats = ref<IAIChat[]>([])
const replying = ref(false)
const replyingContent = ref('')
const replyingContentMD = ref('')

const { app } = storeToRefs(useTempStore())
const scrollContainer = ref<HTMLDivElement>()
const { render } = useMarkdown(app)

function isCreate() {
  return id.value === 'create'
}

function dateVisible(item: IAIChat, index: number): boolean {
  let visible = false
  if (index == 0) {
    visible = true
  } else {
    const prev = index > 0 ? chats.value[index - 1] : null
    if (prev != null && formatDate(prev.createdAt) !== formatDate(item.createdAt)) {
      visible = true
    }
  }

  return visible
}

if (!isCreate()) {
  initQuery({
    handle: async (data: any, error: string) => {
      if (error) {
        toast(t(error), 'error')
      } else {
        const items = []
        items.push({ ...data.aiChat, md: await render(data.aiChat.content) })
        for (const it of data.aiChats) {
          items.push({ ...it, md: await render(it.content) })
        }
        chats.value = items
        await nextTick()
        scrollBottom()
      }
    },
    document: aichatDetailGQL,
    variables: () => ({
      id: id.value,
      query: `parent_id:${id.value} sort:created_at-asc`,
    }),
    appApi: true,
  })
}

const { mutate: doSend, onDone: sendDone } = initMutation({
  document: createAIChatGQL,
  appApi: true,
})

function send() {
  if (!content.value || replying.value) {
    return
  }
  doSend({
    id: isCreate() ? '' : id.value,
    message: content.value,
    isMe: true,
  })
}

sendDone(async (r: any) => {
  const items = r.data.createAIChat
  if (items) {
    for (const item of items) {
      chats.value?.push({ ...item, md: await render(item.content) })
    }
    const create = isCreate()
    if (create) {
      id.value = items[0].id!
      replacePathNoReload(mainStore, `/aichats/${id.value}`)
    }
    content.value = ''
    replying.value = !replying.value
    replyingContent.value = ''
    replyingContentMD.value = '<span class="blinking-cursor"></span>'
    await nextTick()
    scrollBottom()
  }
})

function scrollBottom() {
  const div = scrollContainer.value
  if (div) {
    div.scrollTop = div.scrollHeight
  }
}

const deleteId = ref('')
const { mutate: deleteItem, loading: deleteLoading } = initMutation({
  document: deleteAIChatItemsGQL,
  options: {
    update: (cache: ApolloCache<any>) => {
      cache.evict({ id: cache.identify({ __typename: 'AIChat', id: deleteId.value }) })
      const index = chats.value?.findIndex((it) => it.id === deleteId.value)
      if (index !== null) {
        chats.value?.splice(index, 1)
      }
    },
  },
  appApi: true,
})

function deleteMessage(id: string) {
  deleteId.value = id
  deleteItem({ ids: [id] })
}

onMounted(() => {
  emitter.on('ai_chat_replied', async (data: any) => {
    if (data.parentId === id.value) {
      replyingContent.value += data.content
      replyingContentMD.value = await render(replyingContent.value + '<span class="blinking-cursor"></span>')
      if (data.finishReason === 'stop') {
        doSend({
          id: id.value,
          message: replyingContent.value,
          isMe: false,
        })
      }
    }
  })
})
</script>
<style lang="scss" scoped>
.chat-input {
  display: flex;

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

.chat-item {
  padding: 0 16px 0 16px;

  &:first-child {
    padding-top: 16px;
  }

  &.replying {
    padding-bottom: 16px;
  }
}

.chat-items {
  overflow-y: scroll;
  height: 100%;
}

.chat-content {
  margin-top: 8px;
}

.chat-container {
  border-radius: var(--border-radius-sm);
  border: 1px solid var(--border-color);
  height: calc(100vh - 100px);
}

.bi-btn {
  font-size: 1.5rem;
}

.md-container {
  padding-bottom: 0;
}
</style>
