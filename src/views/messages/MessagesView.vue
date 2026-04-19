<template>
  <div class="content">
    <MessageChatHeader
      :name="thread.contactName.value"
      :address="thread.contactAddress.value"
      :show-notification-warning="!app.permissions.includes('NOTIFICATION_LISTENER')"
      @back="backToList"
      @export="openExport"
      @call="send.callContact"
      @archive="archiveConversation"
    />
    <MessageChatList
      v-model:scroll-ref="chatScrollRef"
      :items="thread.sortedItems.value"
      :detail-loading="thread.detailLoading.value"
      :loading="thread.loading.value"
      :loading-more="thread.loadingMore.value"
      :permissions="app.permissions"
      :url-token-key="urlTokenKey"
      @scroll="thread.onScroll"
      @add-to-tags="addItemToTags"
    />
    <MessageChatInput
      v-model="send.messageBody.value"
      v-model:file-input-ref="send.fileInputRef.value"
      :pending-files="send.pendingFiles.value"
      :total-pending-size="send.totalPendingSize.value"
      :has-large-non-image-file="send.hasLargeNonImageFile.value"
      :warn-size="send.MMS_WARN_SIZE"
      :send-disabled="send.sendLoading.value || send.mmsUploading.value"
      @send="onSend"
      @open-file-picker="send.openFilePicker"
      @file-selected="send.onFileSelected"
      @remove-file="send.removePendingFile"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onActivated, onDeactivated, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { replacePath } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import { useTempStore } from '@/stores/temp'
import { storeToRefs } from 'pinia'
import type { IMessage, ITag } from '@/lib/interfaces'
import { openModal } from '@/components/modal'
import ExportSmsModal from '@/views/messages/ExportSmsModal.vue'
import UpdateTagRelationsModal from '@/components/UpdateTagRelationsModal.vue'
import { DataType } from '@/lib/data'
import { useMessageThread } from '@/hooks/message-thread'
import { useMessageSend } from '@/hooks/message-send'
import MessageChatHeader from '@/views/messages/MessageChatHeader.vue'
import MessageChatList from '@/views/messages/MessageChatList.vue'
import MessageChatInput from '@/views/messages/MessageChatInput.vue'
import { initMutation, archiveConversationGQL } from '@/lib/api/mutation'

const mainStore = useMainStore()
const { app, urlTokenKey } = storeToRefs(useTempStore())
const route = useRoute()
const threadId = ref('')
const chatScrollRef = ref<HTMLElement>()
const isArchived = computed(() => route.path.startsWith('/messages/archived'))

const thread = useMessageThread(threadId, chatScrollRef, isArchived)

const send = useMessageSend(
  () => app.value.appDir,
  () => threadId.value,
  () => thread.items.value[0]?.address || '',
  {
    onSmsSent: () => thread.refetchWithRetry(),
    onMmsSent: (id, body, address, attachments) => {
      thread.setPendingMms(id, body, address, attachments)
      thread.fetch()
    },
  },
)

async function onSend() {
  const body = send.messageBody.value.trim()
  const address = thread.items.value[0]?.address
  if (!address) return
  // For plain SMS, set pending bubble before sending
  if (send.pendingFiles.value.length === 0 && body) {
    thread.setPendingSms(body, address)
  }
  await send.sendMessage()
}

function addItemToTags(item: IMessage) {
  openModal(UpdateTagRelationsModal, {
    type: DataType.SMS,
    tags: thread.tags.value,
    item: { key: item.id, title: '', size: 0 },
    selected: thread.tags.value.filter((it) => item.tags?.some((t: ITag) => t.id === it.id)),
  })
}

const { mutate: mutateArchiveConversation } = initMutation({ document: archiveConversationGQL })

function archiveConversation() {
  mutateArchiveConversation({ id: threadId.value, date: Date.now() })
  backToList()
}

function openExport() {
  openModal(ExportSmsModal, {
    items: [...thread.sortedItems.value],
    contactName: thread.contactName.value,
    urlTokenKey: urlTokenKey.value,
  })
}

function backToList() {
  const q = route.query.q
  replacePath(mainStore, q ? `/messages?q=${q}` : `/messages`)
}

const isActive = ref(false)

function applyRouteQuery() {
  const tid = route.params.threadId
  const resolved = typeof tid === 'string' ? tid : Array.isArray(tid) ? tid[0] : ''
  thread.applyThread(resolved)
}

watch(() => route.fullPath, () => {
  if (isActive.value) applyRouteQuery()
})

onActivated(() => {
  isActive.value = true
  thread.subscribe()
  applyRouteQuery()
})

onDeactivated(() => {
  isActive.value = false
  thread.unsubscribe()
})
</script>

<style lang="scss">
.page-content .main-messages {
  flex-direction: row;

  .content {
    flex: 1;
    overflow: hidden;
    width: 0px;
    display: flex;
    flex-direction: column;

    .top-app-bar {
      padding-inline: 0;
    }
  }
}
</style>
