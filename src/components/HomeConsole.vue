<template>
  <div class="chat">
    <div class="top-title">
      {{ app?.deviceName ?? $t('my_phone')
      }}{{ app?.battery ? ' (' + $t('battery_left', { percentage: app?.battery }) + ')' : '' }}
    </div>
    <div class="chat-items-container" ref="scrollContainer">
      <div>
        <div v-for="(chatItem, index) of chatItems" :key="chatItem.id" class="chat-item">
          <div class="date" v-if="dateVisible(chatItem, index)">{{ formatDate(chatItem.createdAt) }}</div>
          <popper>
            <div class="chat-title">
              <span class="name">{{ $t(chatItem.isMe ? 'me' : 'app_name') }}</span>
              <span class="time" v-tooltip="formatDateTimeFull(chatItem.createdAt)">{{
                formatTime(chatItem.createdAt)
              }}</span>
              <span class="sending" v-if="chatItem.id.startsWith('new_')">{{ $t('sending') }}</span>
              <i-material-symbols:expand-more-rounded class="bi bi-more" />
            </div>
            <template #content>
              <div class="menu-items">
                <md-menu-item :headline="$t('delete_message')" @click="deleteMessage(chatItem.id)"
                  :disabled="deleteLoading" />
              </div>
            </template>
          </popper>
          <div class="chat-content">
            <div v-if="chatItem._content.type === 'text'">
              <pre v-html="addLinksToURLs(chatItem._content.value.text)"></pre>
            </div>
            <component v-else :is="getComponent(chatItem._content.type)" :data="chatItem"></component>
          </div>
        </div>
      </div>
    </div>
    <div class="chat-input">
      <div class="textarea-wrapper">
        <div class="drag-mask" v-show="displayDragMask">{{ $t('release_to_send_file') }}</div>
        <md-outlined-text-field type="textarea" rows="2" v-model="chatText" autocomplete="off" @paste="pasteFiles"
          @drop.prevent="dropFiles" @dragenter.prevent="fileDragEnter" @dragleave.prevent="fileDragLeave" class="textarea"
          :placeholder="$t('chat_input_hint')" @keydown.enter.exact.prevent="send"
          @keydown.enter.shift.exact.prevent="chatText += '\n'" @keydown.enter.ctrl.exact.prevent="chatText += '\n'"
          @keydown.enter.alt.exact.prevent="chatText += '\n'" @keydown.enter.meta.exact.prevent="chatText += '\n'" />
      </div>
      <div class="btns">
        <button class="icon-button" @click="sendImages">
          <md-ripple />
          <i-material-symbols:image-outline-rounded />
        </button>
        <button class="icon-button" @click="sendFiles">
          <md-ripple />
          <i-material-symbols:folder-outline-rounded />
        </button>
        <div class="btn-send-container">
          <button class="icon-button btn-send" @click="send" :disable="createLoading">
            <md-ripple />
            <i-material-symbols:send-outline-rounded />
          </button>
        </div>
      </div>
    </div>
    <input ref="fileInput" style="display: none" type="file" multiple @change="uploadFilesChanged" />
    <input ref="imageInput" style="display: none" type="file" accept="image/*, video/*" multiple
      @change="uploadImagesChanged" />
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
import { onMounted, ref } from 'vue'
import type { ApolloCache } from '@apollo/client/core'
import { useTempStore } from '@/stores/temp'
import type { IChatItem } from '@/lib/interfaces'
import ChatFiles from './chat/ChatFiles.vue'
import { useApolloClient } from '@vue/apollo-composable'
import emitter from '@/plugins/eventbus'
import { chatItemFragment } from '@/lib/api/fragments'
import { useChatFilesUpload } from '@/views/hooks/files'
import { shortUUID } from '@/lib/strutil'
import { getVideoData } from '@/lib/file'
import { useTasks } from '@/views/hooks/chat'
import { addLinksToURLs } from '@/lib/strutil'

const { getUploads } = useChatFilesUpload()
const { resolveClient } = useApolloClient()
const scrollContainer = ref<HTMLDivElement>()
const fileInput = ref<HTMLInputElement>()
const imageInput = ref<HTMLInputElement>()
const chatItems = ref<IChatItem[]>([])
const { enqueue: enqueueTask } = useTasks()

const { app } = storeToRefs(useTempStore())
const { externalFilesDir } = app.value

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

function uploadFilesChanged(e: Event) {
  const files = (e.target as HTMLInputElement).files as FileList
  const items: File[] = []
  for (const item of files) {
    items.push(item)
  }
  doUploadFiles(items)
}

async function doUploadFiles(files: File[]) {
  if (!files.length) {
    return
  }
  const uploads = getUploads(externalFilesDir, files)
  const items = []
  const valueItems: any[] = []
  for (const upload of uploads) {
    if (upload.file.type.startsWith('video')) {
      const v = await getVideoData(upload.file)
      valueItems.push({ uri: upload.fileName, size: upload.file.size, duration: v.duration, thumbnail: v.thumbnail })
    } else {
      valueItems.push({ uri: upload.fileName, size: upload.file.size, duration: 0 })
    }
  }
  const _content = {
    type: 'files',
    value: {
      items: valueItems,
    },
  }
  const item: IChatItem = {
    id: 'new_' + shortUUID(),
    isMe: true,
    createdAt: new Date().toISOString(),
    content: JSON.stringify(_content),
    _content,
    __typename: 'ChatItem',
    data: {
      __typename: 'MessageFiles',
      ids: uploads.map((it) => URL.createObjectURL(it.file)),
    },
  }
  items.push(item)
  enqueueTask(item, uploads)
  const client = resolveClient('a')
  updateCache(client.cache, items, chatItemsGQL)
  scrollBottom()
}

function uploadImagesChanged(e: Event) {
  const files = (e.target as HTMLInputElement).files as FileList
  const items: File[] = []
  for (const item of files) {
    items.push(item)
  }
  doUploadImages(items)
}

async function doUploadImages(files: File[]) {
  if (!files.length) {
    return
  }
  const uploads = getUploads(externalFilesDir, files)
  const items = []
  const valueItems: any[] = []
  for (const upload of uploads) {
    if (upload.file.type.startsWith('video')) {
      const v = await getVideoData(upload.file)
      valueItems.push({ uri: upload.fileName, size: upload.file.size, duration: v.duration, thumbnail: v.thumbnail })
    } else {
      valueItems.push({ uri: upload.fileName, size: upload.file.size, duration: 0 })
    }
  }
  const _content = {
    type: 'images',
    value: {
      items: valueItems,
    },
  }
  const item: IChatItem = {
    id: 'new_' + shortUUID(),
    isMe: true,
    createdAt: new Date().toISOString(),
    content: JSON.stringify(_content),
    _content,
    __typename: 'ChatItem',
    data: {
      __typename: 'MessageImages',
      ids: uploads.map((it) => URL.createObjectURL(it.file)),
    },
  }
  items.push(item)
  enqueueTask(item, uploads)
  const client = resolveClient('a')
  updateCache(client.cache, items, chatItemsGQL)
  scrollBottom()
}

function send() {
  if (!chatText.value) {
    return
  }
  create({ content: JSON.stringify({ type: 'text', value: { text: chatText.value } }) })
}

function scrollBottom() {
  const div = scrollContainer.value
  if (div) {
    setTimeout(() => {
      div.scrollTop = div.scrollHeight
    }, 100)
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

function sendImages() {
  imageInput.value!.value = ''
  imageInput.value!.click()
}

function sendFiles() {
  fileInput.value!.value = ''
  fileInput.value!.click()
}

const displayDragMask = ref(false)

function fileDragEnter() {
  displayDragMask.value = true
}

function fileDragLeave() {
  displayDragMask.value = false
}

function dropFiles(e: DragEvent) {
  const fileList = e.dataTransfer?.files as FileList
  displayDragMask.value = false
  if (fileList) {
    const files: File[] = []
    for (const item of fileList) {
      files.push(item)
    }
    if (files.length) {
      doUploadFiles(files)
    }
  }
}

function pasteFiles(e: ClipboardEvent) {
  const items = e.clipboardData?.items as DataTransferItemList
  if (items) {
    const images: File[] = []
    const files: File[] = []
    for (const item of items) {
      if (item.kind !== 'file') {
        continue
      }
      const file = item.getAsFile()!
      if (file.type.startsWith('image') || file.type.startsWith('video')) {
        images.push(file)
      } else {
        files.push(file)
      }
    }
    if (images.length) {
      e.preventDefault()
      doUploadImages(images)
    }
    if (files.length) {
      e.preventDefault()
      doUploadFiles(files)
    }
  }
}

onMounted(() => {
  emitter.on('message_created', async (data: any[]) => {
    const client = resolveClient('a')
    const items = []
    for (const item of data) {
      let data = null
      if (item.data) {
        data = item.data
        data.__typename = item.data.type.split('.').pop()
      }
      items.push({ ...item, data: data, __typename: 'ChatItem' })
    }
    updateCache(client.cache, items, chatItemsGQL)
    scrollBottom()
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
.chat {
  width: var(--quick-content-width);
  flex: 0 0 auto;
  display: flex;
  flex-flow: column;
  height: 100vh;
}

.top-title {
  background-color: var(--md-sys-color-surface-container);
  height: 64px;
}

.chat-input {
  background-color: var(--md-sys-color-surface);
  padding: 8px 16px;

  .btns {
    display: flex;
    flex-direction: row;

    .icon-button+.icon-button {
      margin-inline-start: 8px;
    }

    .btn-send-container {
      flex: 1;
      display: flex;
      justify-content: end;
    }
  }

  .textarea-wrapper {
    position: relative;
    padding-block-end: 8px;

    .textarea {
      display: block;
    }
  }
}

.drag-mask {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 8px;
  background-color: rgba(0, 0, 0, 0.5);
  color: white;
  font-size: 1.2rem;
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 4px;
  border: 2px dashed var(--md-sys-color-primary);
}

.chat-items-container {
  overflow-y: scroll;
  display: flex;
  flex: 1 1 auto;
  background-color: var(--md-sys-color-surface);
  border-top-left-radius: var(--plain-shape-l);

  &>div {
    width: 100%;
  }
}

.chat-content {
  margin-top: 8px;

  pre {
    margin: 0;
    white-space: pre-wrap;
    font-size: 1rem;
    word-break: break-all;
  }
}
</style>
