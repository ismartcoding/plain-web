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
      <ChatMessageItem
        v-for="(chatItem, index) of chatItems"
        :key="chatItem.id"
        :data="chatItem"
        :show-date="dateVisible(chatItem, index)"
        :sender-name="getSenderName(chatItem)"
        :sending-status="sendingText(chatItem.id)"
        :delete-loading="deleteLoading"
        :download-info="downloadProgress[chatItem.id] ?? null"
        :peer="peer"
        @delete="deleteMessage"
        @retry="handleRetry"
      />
    </template>
  </div>
  <ChatInput
    v-if="isChannel || !peer || peer.status === 'paired'"
    v-model="chatText"
    :create-loading="sendLoading"
    @send-message="handleSend"
    @send-files="doUploadFiles"
    @send-images="doUploadImages"
  />
</template>

<script setup lang="ts">
import { ref, computed, onActivated, onDeactivated } from 'vue'
import { formatDate } from '@/lib/format'
import ChatInput from './ChatInput.vue'
import ChatMessageItem from './ChatMessageItem.vue'
import { useMainStore } from '@/stores/main'
import { openModal } from '@/components/modal'
import ChatInfoModal from './ChatInfoModal.vue'
import ChannelInfoModal from './ChannelInfoModal.vue'
import ChatDeliveryStatusModal from './ChatDeliveryStatusModal.vue'
import { replacePath } from '@/plugins/router'
import { useChatRouteId } from './hooks/chat-route'
import { useChatData } from './hooks/chat-data'
import { useChatMessages } from './hooks/chat-messages'
import { useChatUpload } from './hooks/chat-upload'
import type { IChatItem } from '@/lib/interfaces'

const store = useMainStore()
const { chatId, peerId, channelId, isChannel, appDir, openFolder } = useChatRouteId()
const { peers, peer, channel, pageTitle, getSenderName, fetchChannels } = useChatData(chatId, peerId, isChannel, channelId)

const chatText = computed({
  get: () => store.chatTexts[chatId.value] ?? '',
  set: (v: string) => { store.chatTexts[chatId.value] = v },
})

const {
  chatItems, loading, sendLoading, deleteLoading,
  scrollContainer, scrollBottom,
  send, retryMessage, deleteMessage, clearMessages, refetch,
} = useChatMessages(chatId, channelId)

const { doUploadFiles, doUploadImages, sendLongMessageAsFile, sendingText, downloadProgress } = useChatUpload(chatId, channelId, appDir, scrollBottom, chatText, chatItems)

const isActive = ref(false)

function dateVisible(item: IChatItem, index: number): boolean {
  if (index === 0) return true
  const prev = chatItems.value[index - 1]
  return prev != null && formatDate(prev.createdAt) !== formatDate(item.createdAt)
}

function handleSend() {
  if (!chatText.value) return
  if (chatText.value.length > 2048) {
    sendLongMessageAsFile(chatText.value)
  } else {
    send(chatText)
  }
}

function handleRetry(id: string, statusData?: string) {
  openModal(ChatDeliveryStatusModal, {
    onResend: () => retryMessage(id),
    statusData,
  })
}

function openChatInfo() {  if (isChannel.value && channel.value) {
    openModal(ChannelInfoModal, {
      channel: channel.value, peers: peers.value, selfId: '',
      onClear: clearMessages,
      onDeleted: () => replacePath(store, '/chat'),
      onMemberUpdated: () => fetchChannels(),
    })
  } else {
    openModal(ChatInfoModal, { peer: peer.value, onClear: clearMessages })
  }
}

onActivated(() => { isActive.value = true })
onDeactivated(() => { isActive.value = false })
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
</style>
