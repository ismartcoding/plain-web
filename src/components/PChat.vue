<!-- eslint-disable vue/no-v-html -->
<template>
  <div class="quick-content-main">
    <div class="top-app-bar">
      <button v-tooltip="$t('close')" class="btn-icon" @click.prevent="store.quick = ''">
        <i-lucide:x />
      </button>
      <div class="title">{{ app?.deviceName ?? $t('my_phone') }}{{ app?.battery ? ' (' + $t('battery_left', { percentage: app?.battery }) + ')' : '' }}</div>
      <div class="actions">
        <button v-tooltip="$t('files')" class="btn-icon" @click.prevent="openFolder">
          <i-lucide:folder />
        </button>
      </div>
    </div>
    <div ref="scrollContainer" class="quick-content-body">
      <div v-for="(chatItem, index) of chatItems" :key="chatItem.id" class="chat-item">
        <div v-if="dateVisible(chatItem, index)" class="date">{{ formatDate(chatItem.createdAt) }}</div>
        <v-dropdown v-model="menuVisible[chatItem.id]" align="top-left-to-bottom-left">
          <template #trigger>
            <div class="chat-title">
              <span class="name">{{ $t(chatItem.fromId === 'me' ? 'me' : 'app_name') }}</span>
              <time v-tooltip="formatDateTimeFull(chatItem.createdAt)" class="time">{{ formatTime(chatItem.createdAt) }}</time>
              <span v-if="chatItem.id.startsWith('new_')" class="sending">{{ $t('sending') }}</span>
              <i-material-symbols:expand-more-rounded class="bi bi-more" />
            </div>
          </template>
          <div class="dropdown-item" :class="{ 'disabled': deleteLoading }" @click="deleteMessage(chatItem.id); menuVisible[chatItem.id] = false">
            {{ $t('delete_message') }}
          </div>
        </v-dropdown>
        <div class="chat-content">
          <div v-if="chatItem._content.type === 'text'">
            <pre v-html="addLinksToURLs(chatItem._content.value.text)"></pre>
            <ChatLinkPreviews v-if="chatItem._content.value.linkPreviews && chatItem._content.value.linkPreviews.length" :data="chatItem" />
          </div>
          <component :is="getComponent(chatItem._content.type)" v-else :data="chatItem"></component>
        </div>
      </div>
    </div>
    <ChatInput 
      v-model="chatText"
      :create-loading="createLoading"
      @send-message="send"
      @send-files="doUploadFiles"
      @send-images="doUploadImages"
    />
  </div>
</template>

<script setup lang="ts">
import { useMainStore } from '@/stores/main'
import { formatTime, formatDateTimeFull, formatDate } from '@/lib/format'
import ChatImages from './chat/ChatImages.vue'
import ChatLinkPreviews from './chat/ChatLinkPreviews.vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { createChatItemGQL, deleteChatItemGQL, initMutation, insertCache } from '@/lib/api/mutation'
import { chatItemsGQL, initQuery } from '@/lib/api/query'
import toast from './toaster'
import { onMounted, ref, reactive } from 'vue'
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
const chatItems = ref<IChatItem[]>([])
const menuVisible = reactive<Record<string, boolean>>({})
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
  variables: { id: 'local' },
})

function getComponent(type: string) {
  return {
    images: ChatImages,
    files: ChatFiles,
    linkPreviews: ChatLinkPreviews,
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

async function doUploadFiles(files: File[]) {
  if (!files.length) {
    return
  }
  
  // Use the generic upload function with type 'files'
  await handleContentUpload(files, 'files');
}

async function doUploadImages(files: File[]) {
  if (!files.length) {
    return
  }
  
  // Use the generic upload function with type 'images'
  await handleContentUpload(files, 'images');
}

// Generic function for handling uploads of different content types
async function handleContentUpload(files: File[], contentType: string, options: { summary?: string } = {}) {
  const dir = app.value.customChatFolder || externalFilesDir
  const uploads = getUploads(dir, files);
  const items = [];
  const valueItems: any[] = [];
  
  // Process each upload and prepare valueItems
  for (const upload of uploads) {
    // Base item properties
    const itemProps: any = { 
      dir: dir,
      isAppDir: app.value.customChatFolder ? false : true,
      uri: upload.fileName, 
      size: upload.file.size, 
      duration: 0, 
      width: 0, 
      height: 0,
      summary: options.summary
    };
    
    // Handle image/video specific properties
    if (upload.file.type.startsWith('video')) {
      const v = await getVideoData(upload.file);
      itemProps.duration = v.duration;
      itemProps.thumbnail = v.thumbnail;
      itemProps.width = v.width;
      itemProps.height = v.height;
    } else if (upload.file.type.startsWith('image')) {
      const v = await getImageData(upload.file);
      itemProps.width = v.width;
      itemProps.height = v.height;
    }
    
    valueItems.push(itemProps);
  }
  
  // Create content object
  const _content = {
    type: contentType,
    value: {
      items: valueItems,
    },
  };
  
  // Create ChatItem
  const item: IChatItem = {
    id: 'new_' + shortUUID(),
    fromId: 'me',
    toId: 'local',
    createdAt: new Date().toISOString(),
    content: JSON.stringify(_content),
    _content,
    __typename: 'ChatItem',
    data: {
      __typename: contentType === 'images' ? 'MessageImages' : 'MessageFiles',
      ids: uploads.map((it) => URL.createObjectURL(it.file)),
    },
  };

  
  items.push(item);
  enqueueTask(item, uploads);
  const client = resolveClient('a');
  insertCache(client.cache, item, chatItemsGQL, { id: 'local' });
  scrollBottom();
}

function send() {
  if (!chatText.value) {
    return
  }
  
  // Check if the message is longer than 2048 characters
  if (chatText.value.length > 2048) {
    // Convert long message to text file and send as a file
    sendLongMessageAsFile(chatText.value);
  } else {
    // Send as normal text message
    const tempId = 'new_' + shortUUID();
    const tempItem = {
      id: tempId,
      fromId: 'me',
      toId: 'local',
      createdAt: new Date().toISOString(),
      content: JSON.stringify({ type: 'text', value: { text: chatText.value } }),
      _content: { type: 'text', value: { text: chatText.value } },
      __typename: 'ChatItem',
      data: {
        __typename: 'MessageText',
        ids: []
      }
    };
    chatItems.value = [...chatItems.value, tempItem];
    scrollBottom();

    create({ content: tempItem.content }).then(() => {
      chatItems.value = chatItems.value.filter(item => item.id !== tempId);
    });
  }
}

// Function to send long message as a text file
async function sendLongMessageAsFile(message: string) {
  // Create a file from the message content
  const timestamp = Date.now();
  const fileName = `message-${timestamp}.txt`;
  const file = new File([message], fileName, { type: 'text/plain' });
  
  // Create a summary from the first ~250 characters (approximately 3 lines)
  // Trim whitespace and make sure it ends at a word boundary
  const summaryText = message.substring(0, 250).trim();
  const summary = summaryText.lastIndexOf(' ') > 230 
    ? summaryText.substring(0, summaryText.lastIndexOf(' ')) + '...' 
    : summaryText + '...';
  
  // Create a file array and use the existing file upload mechanism
  const files: File[] = [file];
  
  // Use the generic upload function with the summary option
  await handleContentUpload(files, 'files', { summary });
  
  // Clear the message input after sending
  chatText.value = '';
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



function openFolder() {
  const q = buildQuery([
    {
      name: 'parent',
      op: '',
      value: app.value.customChatFolder || externalFilesDir,
    },
    {
      name: 'type',
      op: '',
      value: app.value.customChatFolder ? 'INTERNAL_STORAGE' : 'APP',
    },
    {
      name: 'root_path',
      op: '',
      value: app.value.customChatFolder ? app.value.internalStoragePath : externalFilesDir,
    },
  ])
  replacePath(store, `/files?q=${encodeBase64(q)}`)
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

  emitter.on('message_updated', async (items: any[]) => {
    const client = resolveClient('a')
    const cache = client.cache
    for (const item of items) {
      let data = null
      if (item.data) {
        data = item.data
        data.__typename = item.data.type.split('.').pop()
      }
      const id = item.id
      const cacheId = cache.identify({ __typename: 'ChatItem', id: id })
      const fragment = chatItemFragment
      const f = cache.readFragment({ id: cacheId, fragment })
      if (f) {
        cache.writeFragment({
          id: cacheId,
          fragment,
          data: {
            ...item, data: data,
          },
        })
        scrollBottom()
      }
    }
  })
})
</script>

<style lang="scss" scoped>
.chat-content {
  margin-top: 8px;
  max-width: 800px;
}

</style>
