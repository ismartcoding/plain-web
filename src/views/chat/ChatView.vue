<template>
  <Teleport v-if="isActive" to="#header-end-slot" defer>
    <v-icon-button v-tooltip="$t('refresh')" @click="() => refetch()">
      <i-material-symbols:refresh-rounded />
    </v-icon-button>
    <v-icon-button v-tooltip="$t('files')" @click.prevent="openFolder">
      <i-lucide:folder />
    </v-icon-button>
  </Teleport>
  <div class="top-app-bar">
    <div class="title">{{ pageTitle }}</div>
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
        @forward="handleForward"
        @retry="handleRetry"
        @download-action="handleDownloadAction"
      />
    </template>
  </div>
  <div v-if="notAllowChat" class="chat-notice">{{ noticeText }}</div>
  <ChatInput
    v-else
    v-model="chatText"
    :create-loading="sendLoading"
    @send-message="handleSend"
    @send-files="doUploadFiles"
    @send-images="doUploadImages"
  />
</template>

<script setup lang="ts">
import { ref, computed, onActivated, onDeactivated } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatDate } from '@/lib/format'
import ChatInput from './ChatInput.vue'
import ChatMessageItem from './ChatMessageItem.vue'
import ForwardMessageModal from './ForwardMessageModal.vue'
import { openModal } from '@/components/modal'
import { useMainStore } from '@/stores/main'
import { useChatRouteId } from './hooks/chat-route'
import { useChatData } from './hooks/chat-data'
import { useChatMessages } from './hooks/chat-messages'
import { useChatUpload } from './hooks/chat-upload'
import type { IChatItem } from '@/lib/interfaces'
import { ChannelStatus, PeerStatus } from '@/lib/status'

const { t } = useI18n()
const store = useMainStore()
const { chatId, peerId, channelId, isChannel, appDir, openFolder } = useChatRouteId()
const { peer, channel, pageTitle, getSenderName } = useChatData(chatId, peerId, isChannel, channelId)

const notAllowChat = computed(() => {
  if (isChannel.value) {
    return !!channel.value && channel.value.status !== ChannelStatus.JOINED
  }
  return peer.value?.status === PeerStatus.UNPAIRED
})

const noticeText = computed(() => {
  if (!isChannel.value && peer.value?.status === PeerStatus.UNPAIRED) {
    return t('unpaired')
  }
  if (channel.value?.status === ChannelStatus.KICKED) {
    return t('channel_kicked_notice')
  }
  return t('channel_left_notice')
})

const chatText = computed({
  get: () => store.chatTexts[chatId.value] ?? '',
  set: (v: string) => { store.chatTexts[chatId.value] = v },
})

const {
  chatItems, loading, sendLoading, deleteLoading,
  scrollContainer, scrollBottom,
  send, retryMessage, deleteMessage, refetch,
} = useChatMessages(chatId, channelId)

const { doUploadFiles, doUploadImages, sendLongMessageAsFile, sendingText, downloadProgress, handleDownloadAction } = useChatUpload(chatId, channelId, appDir, scrollBottom, chatText, chatItems)

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

function handleRetry(id: string) {
  retryMessage(id)
}

function handleForward(item: IChatItem) {
  openModal(ForwardMessageModal, { message: item, excludeChatId: chatId.value })
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

.chat-notice {
  padding: 12px 16px;
  text-align: center;
  font-size: 14px;
  color: var(--md-sys-color-on-surface);
}
</style>
