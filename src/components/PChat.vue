<template>
  <div class="quick-content-main">
    <div class="top-app-bar">
      <button v-tooltip="$t('close')" class="btn-icon" @click.prevent="store.quick = ''">
        <md-ripple />
        <i-material-symbols:right-panel-close-outline />
      </button>
      <div class="title">{{ app?.deviceName ?? $t('my_phone') }}{{ app?.battery ? ' (' + $t('battery_left', { percentage: app?.battery }) + ')' : '' }}</div>
      <div class="actions">
        <button v-tooltip="$t('files')" class="btn-icon" @click.prevent="openFolder">
          <md-ripple />
          <i-lucide:folder />
        </button>
      </div>
    </div>
    <div ref="scrollContainer" class="quick-content-body">
      <div v-for="(chatItem, index) of chatItems" :key="chatItem.id" class="chat-item">
        <div v-if="dateVisible(chatItem, index)" class="date">{{ formatDate(chatItem.createdAt) }}</div>
        <popper>
          <div class="chat-title">
            <span class="name">{{ $t(chatItem.isMe ? 'me' : 'app_name') }}</span>
            <time v-tooltip="formatDateTimeFull(chatItem.createdAt)" class="time">{{ formatTime(chatItem.createdAt) }}</time>
            <span v-if="chatItem.id.startsWith('new_')" class="sending">{{ $t('sending') }}</span>
            <i-material-symbols:expand-more-rounded class="bi bi-more" />
          </div>
          <template #content>
            <div class="menu-items">
              <md-menu-item :disabled="deleteLoading" @click="deleteMessage(chatItem.id)">
                <div slot="headline">{{ $t('delete_message') }}</div>
              </md-menu-item>
            </div>
          </template>
        </popper>
        <div class="chat-content">
          <div v-if="chatItem._content.type === 'text'">
            <pre v-html="addLinksToURLs(chatItem._content.value.text)"></pre>
          </div>
          <component :is="getComponent(chatItem._content.type)" v-else :data="chatItem"></component>
        </div>
      </div>
    </div>
    <div class="chat-input">
      <div class="textarea-wrapper">
        <div v-show="displayDragMask" class="drag-mask">{{ $t('release_to_send_files') }}</div>
        <md-outlined-text-field
          v-model="chatText"
          type="textarea"
          rows="2"
          autocomplete="off"
          class="textarea"
          :placeholder="$t('chat_input_hint')"
          @paste="pasteFiles"
          @drop.prevent="dropFiles"
          @dragenter.prevent="fileDragEnter"
          @dragleave.prevent="fileDragLeave"
          @keydown.enter.exact.prevent="send"
          @keydown.enter.shift.exact.prevent="chatText += '\n'"
          @keydown.enter.ctrl.exact.prevent="chatText += '\n'"
          @keydown.enter.alt.exact.prevent="chatText += '\n'"
          @keydown.enter.meta.exact.prevent="chatText += '\n'"
        >
          <div slot="leading-icon" class="leading-icons">
            <button class="btn-icon" @click="sendImages">
              <md-ripple />
              <i-material-symbols:image-outline-rounded />
            </button>
            <button class="btn-icon" @click="sendFiles">
              <md-ripple />
              <i-material-symbols:folder-outline-rounded />
            </button>
          </div>
          <button slot="trailing-icon" class="btn-icon btn-send" :disable="createLoading" @click="send">
            <md-ripple />
            <i-material-symbols:send-outline-rounded />
          </button>
        </md-outlined-text-field>
      </div>
    </div>
    <input ref="fileInput" style="display: none" type="file" multiple @change="uploadFilesChanged" />
    <input ref="imageInput" style="display: none" type="file" accept="image/*, video/*" multiple @change="uploadImagesChanged" />
  </div>
</template>

<script setup lang="ts">
import { useMainStore } from '@/stores/main'
import { formatTime, formatDateTimeFull, formatDate } from '@/lib/format'
import ChatImages from './chat/ChatImages.vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { createChatItemGQL, deleteChatItemGQL, initMutation, insertCache } from '@/lib/api/mutation'
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
import { useChatFilesUpload } from '@/hooks/upload'
import { encodeBase64, shortUUID } from '@/lib/strutil'
import { getVideoData, getImageData } from '@/lib/file'
import { useTasks } from '@/hooks/chat'
import { addLinksToURLs } from '@/lib/strutil'
import { buildQuery } from '@/lib/search'
import { replacePath } from '@/plugins/router'

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
      insertCache(cache, data.data.createChatItem, chatItemsGQL)
    },
  },
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
      valueItems.push({ uri: upload.fileName, size: upload.file.size, duration: v.duration, thumbnail: v.thumbnail, width: v.width, height: v.height })
    } else if (upload.file.type.startsWith('image')) {
      const v = await getImageData(upload.file)
      valueItems.push({ uri: upload.fileName, size: upload.file.size, duration: 0, width: v.width, height: v.height })
    } else {
      valueItems.push({ uri: upload.fileName, size: upload.file.size, duration: 0, width: 0, height: 0 })
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
  insertCache(client.cache, items, chatItemsGQL)
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
      valueItems.push({ uri: upload.fileName, size: upload.file.size, duration: v.duration, thumbnail: v.thumbnail, width: v.width, height: v.height })
    } else {
      const v = await getImageData(upload.file)
      valueItems.push({ uri: upload.fileName, size: upload.file.size, duration: 0, width: v.width, height: v.height })
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
  insertCache(client.cache, items, chatItemsGQL)
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
})

function deleteMessage(id: string) {
  deleteId.value = id
  deleteItem({ id })
}

function sendImages() {
  imageInput.value!.value = ''
  imageInput.value!.click()
}

function openFolder() {
  const q = buildQuery([
    {
      name: 'parent',
      op: '',
      value: app.value.externalFilesDir,
    },
    {
      name: 'link_name',
      op: '',
      value: 'app',
    },
  ])
  replacePath(store, `/files?q=${encodeBase64(q)}`)
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
    insertCache(client.cache, items, chatItemsGQL)
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
.chat-input {
  background-color: var(--md-sys-color-surface);
  padding: 8px 16px;

  .leading-icons {
    display: flex;
    flex-direction: column;
  }

  .textarea-wrapper {
    position: relative;
    .textarea {
      display: block;
    }
  }
}

.chat-content {
  margin-top: 8px;
  max-width: 800px;
}
</style>
