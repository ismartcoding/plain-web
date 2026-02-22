<!-- eslint-disable vue/no-v-html -->
<template>
  <Teleport v-if="isActive" to="#header-end-slot" defer>
    <v-icon-button v-tooltip="$t('refresh')" @click="refetch">
      <i-material-symbols:refresh-rounded />
    </v-icon-button>
    <v-icon-button v-tooltip="$t('files')" @click.prevent="openFolder">
      <i-lucide:folder />
    </v-icon-button>
  </Teleport>
  <div class="top-app-bar">
    <div class="title">{{ pageTitle }}</div>
    <v-icon-button v-tooltip="$t('chat_info')" @click="openChatInfo">
      <i-material-symbols:more-vert />
    </v-icon-button>
  </div>
  <div ref="scrollContainer" class="chat-view-body">
    <div v-if="loading && chatItems.length === 0" class="loading-state">
      <v-circular-progress indeterminate class="sm" />
    </div>
    <template v-else>
      <div v-for="(chatItem, index) of chatItems" :key="chatItem.id" class="chat-item">
        <div v-if="dateVisible(chatItem, index)" class="date">{{ formatDate(chatItem.createdAt) }}</div>
        <v-dropdown v-model="menuVisible[chatItem.id]" align="top-left-to-bottom-left">
          <template #trigger>
            <div class="chat-title">
              <span class="name">{{ getSenderName(chatItem) }}</span>
              <time v-tooltip="formatDateTimeFull(chatItem.createdAt)" class="time">{{ formatTime(chatItem.createdAt) }}</time>
              <span v-if="chatItem.id.startsWith('new_')" class="sending">{{ sendingText(chatItem.id) }}</span>
              <i-material-symbols:expand-more-rounded class="bi bi-more" />
            </div>
          </template>
          <div class="dropdown-item" :class="{ disabled: deleteLoading }" @click="deleteMessage(chatItem.id); menuVisible[chatItem.id] = false">
            {{ $t('delete_message') }}
          </div>
        </v-dropdown>
        <div class="chat-content">
          <div v-if="chatItem._content.type === 'text'">
            <pre v-html="addLinksToURLs(chatItem._content.value.text)"></pre>
            <ChatLinkPreviews v-if="chatItem._content.value.linkPreviews && chatItem._content.value.linkPreviews.length" :data="chatItem" />
          </div>
          <component :is="getComponent(chatItem._content.type)" v-else :data="chatItem" :download-info="downloadProgress[chatItem.id] ?? null" :peer="peer" />
        </div>
      </div>
    </template>
  </div>
  <ChatInput
    v-if="!peer || peer.status === 'paired'"
    v-model="chatText"
    :create-loading="sendLoading"
    @send-message="send"
    @send-files="doUploadFiles"
    @send-images="doUploadImages"
  />
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onActivated, onDeactivated, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import type { ApolloCache } from '@apollo/client/core'
import { useApolloClient } from '@vue/apollo-composable'
import { formatTime, formatDateTimeFull, formatDate, formatFileSize } from '@/lib/format'
import ChatImages from '@/components/chat/ChatImages.vue'
import ChatLinkPreviews from '@/components/chat/ChatLinkPreviews.vue'
import ChatFiles from '@/components/chat/ChatFiles.vue'
import ChatInput from '@/components/ChatInput.vue'
import { initQuery, initLazyQuery, chatItemsGQL, peersGQL } from '@/lib/api/query'
import { sendChatItemGQL, deleteChatItemGQL, initMutation, insertCache } from '@/lib/api/mutation'
import { chatItemFragment } from '@/lib/api/fragments'
import toast from '@/components/toaster'
import { useMainStore } from '@/stores/main'
import { useTempStore } from '@/stores/temp'
import type { IChatItem, IPeer } from '@/lib/interfaces'
import { useChatFilesUpload } from '@/hooks/upload'
import { openModal } from '@/components/modal'
import ChatInfoModal from './ChatInfoModal.vue'
import { encodeBase64, shortUUID, addLinksToURLs } from '@/lib/strutil'
import { buildQuery } from '@/lib/search'
import { replacePath } from '@/plugins/router'
import type { IUploadItem } from '@/stores/temp'
import emitter from '@/plugins/eventbus'
import { getVideoData, getImageData, isVideo } from '@/lib/file'
import { useTasks } from '@/hooks/chat'
import { chachaDecrypt } from '@/lib/api/crypto'
import * as sjcl from 'sjcl'

const route = useRoute()
const { t } = useI18n()
const store = useMainStore()
const chatText = computed({
  get: () => store.chatTexts[chatId.value] ?? '',
  set: (v: string) => {
    store.chatTexts[chatId.value] = v
  },
})
const tempStore = useTempStore()
const { app, urlTokenKey } = storeToRefs(tempStore)
const { getUploads } = useChatFilesUpload()
const { resolveClient } = useApolloClient()
const scrollContainer = ref<HTMLDivElement>()
const chatItems = ref<IChatItem[]>([])
const menuVisible = reactive<Record<string, boolean>>({})
const { enqueue: enqueueTask, cancel: cancelTask } = useTasks()
const uploading = ref<IUploadItem[]>([])
const messageUploads = reactive<Record<string, IUploadItem[]>>({})
const uploadToMessage = new Map<string, string>()
const sendingAgg = reactive<Record<string, { uploaded: number; speed: number }>>({})
const deleteId = ref('')
const peers = ref<IPeer[]>([])
const isActive = ref(false)
const downloadProgress = reactive<Record<string, { downloaded: number; total: number; speed: number; status: string }>>({})

let initialized = false

function getChatIdFromRoute(rawId: string) {
  if (!rawId) return 'local'

  try {
    if (!urlTokenKey.value) return 'local'
    const bits = sjcl.codec.base64.toBits(rawId)
    const decrypted = chachaDecrypt(urlTokenKey.value, bits)
    if (decrypted.startsWith('peer:')) {
      return decrypted
    }
  } catch {
    // ignore malformed id
  }

  return 'local'
}

const routeId = computed(() => {
  const qid = route.query.id
  return typeof qid === 'string' ? qid : ''
})
const chatId = computed(() => getChatIdFromRoute(routeId.value))
const peerId = computed(() => (chatId.value.startsWith('peer:') ? chatId.value.slice(5) : ''))
const { appDir } = app.value

const peer = computed(() => peers.value.find((p) => p.id === peerId.value) ?? null)

const pageTitle = computed(() => {
  if (chatId.value === 'local') return app.value?.deviceName ?? t('my_phone')
  return peer.value?.name ?? peerId.value
})

function getSenderName(chatItem: IChatItem) {
  if (chatItem.fromId === 'me') return t('me')
  if (chatId.value === 'local') return app.value?.deviceName ?? t('my_phone')
  return peer.value?.name ?? chatItem.fromId
}

function sendingText(messageId: string) {
  const agg = sendingAgg[messageId]
  if (!agg) return t('sending') as unknown as string
  return `${t('sending')} ${formatFileSize(agg.uploaded)} (${formatFileSize(agg.speed)}/s)`
}

function dateVisible(item: IChatItem, index: number): boolean {
  if (index === 0) return true
  const prev = chatItems.value[index - 1]
  return prev != null && formatDate(prev.createdAt) !== formatDate(item.createdAt)
}

function getComponent(type: string) {
  return ({ images: ChatImages, files: ChatFiles, linkPreviews: ChatLinkPreviews } as any)[type]
}

// Load peers for sidebar title display
initLazyQuery({
  handle: (data: { peers: IPeer[] }) => {
    if (data?.peers) peers.value = data.peers
  },
  document: peersGQL,
  variables: () => ({}),
}).fetch()

const { loading, refetch } = initQuery({
  handle: async (data: any, error: string) => {
    if (error) {
      toast(t(error), 'error')
    } else if (data) {
      chatItems.value = data.chatItems
      if (!initialized) {
        scrollBottom()
        initialized = true
      }
    }
  },
  document: chatItemsGQL,
  variables: () => ({ id: chatId.value }),
})

const {
  mutate: sendMutate,
  loading: sendLoading,
  onDone: sendDone,
} = initMutation({
  document: sendChatItemGQL,
  options: {
    update: (cache: ApolloCache<any>, data: any) => {
      insertCache(cache, data.data.sendChatItem, chatItemsGQL, { id: chatId.value })
    },
  },
})

const { mutate: deleteItem, loading: deleteLoading } = initMutation({
  document: deleteChatItemGQL,
  options: {
    update: (cache: ApolloCache<any>) => {
      cache.evict({ id: cache.identify({ __typename: 'ChatItem', id: deleteId.value }) })
    },
  },
})

sendDone(() => {
  scrollBottom()
})

async function doUploadFiles(files: File[]) {
  if (!files.length) return
  await handleContentUpload(files, 'files')
}

async function doUploadImages(files: File[]) {
  if (!files.length) return
  await handleContentUpload(files, 'images')
}

async function handleContentUpload(files: File[], contentType: string, options: { summary?: string } = {}) {
  const dir = appDir
  const uploads = getUploads(dir, files)
  uploads.forEach((u) => {
    u.status = 'pending'
    u.isAppFile = true
  })

  const valueItems: any[] = []

  for (const upload of uploads) {
    const itemProps: any = {
      dir,
      uri: upload.fileName || upload.file.name,
      size: upload.file.size,
      duration: 0,
      width: 0,
      height: 0,
      summary: options.summary,
    }
    if (upload.file.type.startsWith('video') || isVideo(upload.file.name)) {
      const v = await getVideoData(upload.file)
      itemProps.duration = v.duration
      itemProps.thumbnail = v.thumbnail
      itemProps.width = v.width
      itemProps.height = v.height
    } else if (upload.file.type.startsWith('image')) {
      const v = await getImageData(upload.file)
      itemProps.width = v.width
      itemProps.height = v.height
    }
    valueItems.push(itemProps)
  }

  const _content = { type: contentType, value: { items: valueItems } }
  const item: IChatItem = {
    id: 'new_' + shortUUID(),
    fromId: 'me',
    toId: chatId.value,
    createdAt: new Date().toISOString(),
    content: JSON.stringify(_content),
    _content,
    __typename: 'ChatItem',
    data: {
      __typename: contentType === 'images' ? 'MessageImages' : 'MessageFiles',
      ids: uploads.map((it) => URL.createObjectURL(it.file)),
    },
  }

  messageUploads[item.id] = uploads
  uploads.forEach((u) => uploadToMessage.set(u.id, item.id))
  sendingAgg[item.id] = {
    uploaded: uploads.reduce((s, u) => s + (u.uploadedSize || 0), 0),
    speed: uploads.reduce((s, u) => s + (u.uploadSpeed || 0), 0),
  }
  uploading.value = [...uploading.value, ...uploads]
  enqueueTask(item, uploads, chatId.value)
  const client = resolveClient('a')
  insertCache(client.cache, item, chatItemsGQL, { id: chatId.value })
  scrollBottom()
}

function send() {
  if (!chatText.value) return

  if (chatText.value.length > 2048) {
    sendLongMessageAsFile(chatText.value)
  } else {
    const tempId = 'new_' + shortUUID()
    const tempItem: IChatItem = {
      id: tempId,
      fromId: 'me',
      toId: chatId.value,
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
}

async function sendLongMessageAsFile(message: string) {
  const fileName = `message-${Date.now()}.txt`
  const file = new File([message], fileName, { type: 'text/plain' })
  const summaryText = message.substring(0, 250).trim()
  const summary =
    summaryText.lastIndexOf(' ') > 230
      ? summaryText.substring(0, summaryText.lastIndexOf(' ')) + '...'
      : summaryText + '...'
  await handleContentUpload([file], 'files', { summary })
  chatText.value = ''
}

function scrollBottom() {
  const div = scrollContainer.value
  if (!div) return
  setTimeout(() => {
    div.scrollTop = div.scrollHeight
  }, 100)
}

function deleteMessage(id: string) {
  deleteId.value = id
  deleteItem({ id })
  cancelTask(id)
}

function openChatInfo() {
  openModal(ChatInfoModal, {
    peer: peer.value,
    onClear: clearMessages,
  })
}

async function clearMessages(): Promise<void> {
  const ids = chatItems.value.filter((i) => !i.id.startsWith('new_')).map((i) => i.id)
  for (const id of ids) {
    cancelTask(id)
    deleteId.value = id
    await deleteItem({ id })
  }
}

function openFolder() {
  const q = buildQuery([
    { name: 'parent', op: '', value: appDir },
    { name: 'type', op: '', value: 'APP' },
    { name: 'root_path', op: '', value: appDir },
  ])
  replacePath(store, `/files?q=${encodeBase64(q)}`)
}

// Re-initialize on route change
watch(
  () => route.query.id,
  () => {
    initialized = false
    chatItems.value = []
    refetch()
    scrollBottom()
  }
)

const _handlers: Record<string, (...args: any[]) => any> = {}

onMounted(() => {
  _handlers.upload_progress = (u: IUploadItem) => {
    const mid = uploadToMessage.get(u.id)
    if (!mid) return
    const list = messageUploads[mid]
    if (!list) return
    sendingAgg[mid] = {
      uploaded: list.reduce((s, it) => s + (it.uploadedSize || 0), 0),
      speed: list.reduce((s, it) => s + (it.uploadSpeed || 0), 0),
    }
  }
  emitter.on('upload_progress', _handlers.upload_progress)

  _handlers.message_created = async (data: any[]) => {
    const client = resolveClient('a')
    const items = []
    for (const item of data) {
      const itemToId = item.toId === 'local' ? 'local' : `peer:${item.toId}`
      if (itemToId !== chatId.value && item.fromId !== peerId.value) continue
      let itemData = null
      if (item.data) {
        itemData = item.data
        itemData.__typename = item.data.type.split('.').pop()
      }
      items.push({ ...item, data: itemData, __typename: 'ChatItem' })
    }
    if (items.length > 0) {
      // Deduplicate: skip items whose id already exists in the cache
      const cached: any = client.cache.readQuery({ query: chatItemsGQL, variables: { id: chatId.value } })
      const existingIds = new Set((cached?.chatItems ?? []).map((i: any) => i.id))
      const newItems = items.filter((i) => !existingIds.has(i.id))
      if (newItems.length > 0) {
        insertCache(client.cache, newItems, chatItemsGQL, { id: chatId.value })
        scrollBottom()
      }
    }
  }
  emitter.on('message_created', _handlers.message_created)

  _handlers.message_deleted = async (data: string[]) => {
    const client = resolveClient('a')
    const cache = client.cache
    for (const id of data) {
      cache.evict({ id: cache.identify({ __typename: 'ChatItem', id }) })
    }
  }
  emitter.on('message_deleted', _handlers.message_deleted)

  _handlers.message_cleared = (toId: string) => {
    const clearedChatId = toId === 'local' ? 'local' : `peer:${toId}`
    if (clearedChatId !== chatId.value) return
    const client = resolveClient('a')
    client.cache.writeQuery({
      query: chatItemsGQL,
      variables: { id: chatId.value },
      data: { chatItems: [] },
    })
    chatItems.value = []
  }
  emitter.on('message_cleared', _handlers.message_cleared)

  _handlers.message_updated = async (items: any[]) => {
    const client = resolveClient('a')
    const cache = client.cache
    for (const item of items) {
      let itemData = null
      if (item.data) {
        itemData = item.data
        itemData.__typename = item.data.type.split('.').pop()
      }
      const cacheId = cache.identify({ __typename: 'ChatItem', id: item.id })
      const f = cache.readFragment({ id: cacheId, fragment: chatItemFragment })
      if (f) {
        cache.writeFragment({
          id: cacheId,
          fragment: chatItemFragment,
          data: { ...item, data: itemData },
        })
        scrollBottom()
      }
    }
  }
  emitter.on('message_updated', _handlers.message_updated)

  _handlers.download_progress = (items: any[]) => {
    const newProgress: Record<string, { downloaded: number; total: number; speed: number; status: string }> = {}
    for (const item of items) {
      const msgId = item.messageId
      if (!newProgress[msgId]) {
        newProgress[msgId] = { downloaded: 0, total: 0, speed: 0, status: 'pending' }
      }
      newProgress[msgId].downloaded += item.downloaded
      newProgress[msgId].total += item.total
      newProgress[msgId].speed += item.speed
      const s = item.status
      const cur = newProgress[msgId].status
      if (s === 'downloading') newProgress[msgId].status = 'downloading'
      else if (s === 'paused' && cur !== 'downloading') newProgress[msgId].status = 'paused'
      else if (s === 'failed' && cur === 'pending') newProgress[msgId].status = 'failed'
    }
    Object.keys(downloadProgress).forEach((k) => delete downloadProgress[k])
    Object.assign(downloadProgress, newProgress)
  }
  emitter.on('download_progress', _handlers.download_progress)
})

onUnmounted(() => {
  Object.entries(_handlers).forEach(([event, fn]) => {
    emitter.off(event as any, fn)
  })
})
onActivated(() => {
  isActive.value = true
})
onDeactivated(() => {
  isActive.value = false
})
</script>

<style lang="scss">
.page-content .main-chat {
  display: flex;
  flex-direction: column;
}
</style>

<style lang="scss" scoped>
.chat-view-body {
  flex: 1;
  overflow-y: auto;
}

.loading-state {
  display: flex;
  justify-content: center;
  padding: 40px;
}

.chat-content {
  margin-top: 8px;
  max-width: 800px;
}
</style>
