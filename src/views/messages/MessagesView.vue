<!-- eslint-disable vue/no-v-html -->
<template>
  <div class="content">
    <div class="chat-header">
      <v-icon-button v-tooltip="$t('back')" @click.stop="backToList">
        <i-material-symbols:arrow-back-rounded />
      </v-icon-button>
      <div class="chat-header-info">
        <span class="chat-header-name">{{ contactName }}</span>
        <span v-if="contactAddress" class="chat-header-address">{{ contactAddress }}</span>
      </div>
      <div class="chat-header-actions">
        <v-icon-button v-tooltip="$t('call')" @click.stop="callContact">
          <i-material-symbols:call-outline-rounded />
        </v-icon-button>
      </div>
    </div>
    <div ref="chatScrollRef" class="chat-messages" @scroll="onScroll">
      <div v-if="detailLoading" class="chat-loading">
        <v-circular-progress indeterminate class="sm" />
      </div>
      <template v-else>
        <div v-for="(item, index) in sortedItems" :key="item.id" class="chat-message-wrapper">
          <div v-if="showDateSeparator(index)" class="chat-date-separator">
            <span>{{ formatDateLabel(item.date) }}</span>
          </div>
          <div
            class="chat-bubble-row"
            :class="{ sent: isSent(item), received: !isSent(item) }"
          >
            <div class="chat-bubble-with-actions">
              <v-icon-button
                v-tooltip="$t('add_to_tags')"
                class="chat-tag-btn"
                @click.stop="addItemToTags(item)"
              >
                <i-material-symbols:label-outline-rounded />
              </v-icon-button>
              <div class="chat-bubble">
                <div v-if="item.body" v-html="addLinksToURLs(item.body)"></div>
                <div v-if="item.attachments?.length" class="chat-attachments">
                  <template v-for="(attachment, idx) in item.attachments" :key="`${item.id}-att-${idx}`">
                    <img
                      v-if="isImageAttachment(attachment.contentType)"
                      class="chat-attachment-image"
                      :src="attachmentUrl(attachment.path)"
                      :alt="attachment.name || 'mms-image'"
                    />
                    <video
                      v-else-if="isVideoAttachment(attachment.contentType)"
                      class="chat-attachment-video"
                      :src="attachmentUrl(attachment.path)"
                      controls
                      preload="metadata"
                    />
                    <audio
                      v-else-if="isAudioAttachment(attachment.contentType)"
                      class="chat-attachment-audio"
                      :src="attachmentUrl(attachment.path)"
                      controls
                      preload="metadata"
                    />
                    <a
                      v-else
                      class="chat-attachment-link"
                      :href="attachmentUrl(attachment.path)"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {{ attachment.name || attachment.contentType || attachment.path }}
                    </a>
                  </template>
                </div>
              </div>
            </div>
            <div v-if="item.tags?.length" class="chat-bubble-tags">
              <span v-for="tag in item.tags" :key="tag.id" class="chat-tag-chip">{{ tag.name }}</span>
            </div>
            <span class="chat-time" v-tooltip="formatDateTime(item.date)">{{ formatTime(item.date) }}</span>
          </div>
        </div>
      </template>
      <div v-if="!detailLoading && items.length === 0" class="no-data-placeholder">
        {{ $t(noDataKey(loading, app.permissions, 'READ_SMS')) }}
      </div>
    </div>
    <div class="chat-input-bar">
      <v-text-field
        v-model="messageBody"
        type="textarea"
        :rows="1"
        :placeholder="$t('write_a_message')"
        class="chat-input-field"
        @keydown.enter.exact.prevent="sendMessage"
      />
      <v-icon-button class="chat-send-btn" :loading="sendLoading" @click="sendMessage">
        <i-material-symbols:send-rounded />
      </v-icon-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, onActivated, onDeactivated, ref, watch } from 'vue'
import toast from '@/components/toaster'
import { initLazyQuery, smsGQL } from '@/lib/api/query'
import { useRoute } from 'vue-router'
import { replacePath } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import { useTempStore } from '@/stores/temp'
import { useI18n } from 'vue-i18n'
import { noDataKey } from '@/lib/list'
import { storeToRefs } from 'pinia'
import type { IItemTagsUpdatedEvent, IItemsTagsUpdatedEvent, IMessage, ITag } from '@/lib/interfaces'
import { useTags } from '@/hooks/tags'
import emitter from '@/plugins/eventbus'
import { openModal } from '@/components/modal'
import SendSmsModal from '@/components/messages/SendSmsModal.vue'
import UpdateTagRelationsModal from '@/components/UpdateTagRelationsModal.vue'
import { DataType } from '@/lib/data'
import { callGQL, initMutation, sendSmsGQL } from '@/lib/api/mutation'
import { buildQuery } from '@/lib/search'
import { useContactName } from '@/hooks/contacts'
import { formatDateTime, formatTime } from '@/lib/format'
import { addLinksToURLs } from '@/lib/strutil'
import { getFileUrlByPath } from '@/lib/api/file'

const isPhone = inject('isPhone') as boolean
const mainStore = useMainStore()
const { app, urlTokenKey } = storeToRefs(useTempStore())
const items = ref<IMessage[]>([])
const { t } = useI18n()
const { loadContacts, getContactName, getDisplayName } = useContactName()

const dataType = DataType.SMS
const route = useRoute()
const threadId = ref('')
const detailLoading = ref(false)
const messageBody = ref('')
const chatScrollRef = ref<HTMLElement>()
const { tags, fetch: fetchTags } = useTags(dataType)

const contactName = computed(() => {
  const address = items.value[0]?.address || ''
  return address ? getDisplayName(address) : ''
})

const contactAddress = computed(() => {
  const address = items.value[0]?.address || ''
  const name = getContactName(address)
  // Only show address separately if contact has a name (to avoid showing address twice)
  return name ? address : ''
})

const sortedItems = computed(() => {
  return [...items.value].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
})

function isSent(item: IMessage): boolean {
  // type 2 = sent, 4 = outbox
  return item.type === 2 || item.type === 4
}

function showDateSeparator(index: number): boolean {
  if (index === 0) return true
  const current = new Date(sortedItems.value[index].date).toDateString()
  const prev = new Date(sortedItems.value[index - 1].date).toDateString()
  return current !== prev
}

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)

  if (date.toDateString() === today.toDateString()) return t('today')
  if (date.toDateString() === yesterday.toDateString()) return t('yesterday')
  return formatDateTime(dateStr, { dateStyle: 'medium' })
}

function attachmentUrl(path: string): string {
  return getFileUrlByPath(urlTokenKey.value, path)
}

function isImageAttachment(contentType: string): boolean {
  return contentType.startsWith('image/')
}

function isVideoAttachment(contentType: string): boolean {
  return contentType.startsWith('video/')
}

function isAudioAttachment(contentType: string): boolean {
  return contentType.startsWith('audio/')
}

function scrollToBottom() {
  nextTick(() => {
    if (chatScrollRef.value) {
      chatScrollRef.value.scrollTop = chatScrollRef.value.scrollHeight
    }
  })
}

function onScroll() {
  // placeholder for future infinite scroll
}

const { loading, fetch } = initLazyQuery({
  handle: (data: { sms: IMessage[]; smsCount: number }, error: string) => {
    detailLoading.value = false
    if (error) {
      toast(t(error), 'error')
    } else if (data) {
      items.value = data.sms
      scrollToBottom()
    }
  },
  document: smsGQL,
  variables: () => ({
    offset: 0,
    limit: 5000,
    query: buildQuery([{ name: 'thread_id', op: '', value: threadId.value }]),
  }),
})

const { mutate: mutateCall } = initMutation({
  document: callGQL,
})

function callContact() {
  const address = items.value[0]?.address
  if (address) {
    mutateCall({ number: address })
  }
}

const { mutate: mutateSendSms, loading: sendLoading, onDone: onSendDone } = initMutation({
  document: sendSmsGQL,
})

onSendDone(() => {
  messageBody.value = ''
  emitter.emit('sms_sent' as any)
  fetch()
})

function sendMessage() {
  const body = messageBody.value.trim()
  const address = items.value[0]?.address
  if (!body || !address) return
  mutateSendSms({ number: address, body })
}

function addItemToTags(item: IMessage) {
  openModal(UpdateTagRelationsModal, {
    type: dataType,
    tags: tags.value,
    item: {
      key: item.id,
      title: '',
      size: 0,
    },
    selected: tags.value.filter((it) => item.tags?.some((t: ITag) => t.id === it.id)),
  })
}

function openSendSms(number = '', body = '') {
  openModal(SendSmsModal, { number, body })
}

function backToList() {
  const q = route.query.q
  replacePath(mainStore, q ? `/messages?q=${q}` : `/messages`)
}

const smsSentHandler = () => {
  fetch()
}

const itemsTagsUpdatedHandler = (event: IItemsTagsUpdatedEvent) => {
  if (event.type === dataType) {
    fetch()
  }
}

const itemTagsUpdatedHandler = (event: IItemTagsUpdatedEvent) => {
  if (event.type === dataType) {
    fetch()
  }
}

const isActive = ref(false)

function applyRouteQuery() {
  const tid = route.params.threadId
  threadId.value = typeof tid === 'string' ? tid : (Array.isArray(tid) ? tid[0] : '')
  if (!threadId.value) {
    items.value = []
    detailLoading.value = false
    return
  }
  items.value = []
  detailLoading.value = true
  fetch()
}

watch(
  () => route.fullPath,
  () => {
    if (!isActive.value) return
    applyRouteQuery()
  },
)

onActivated(() => {
  fetchTags()
  loadContacts()
  isActive.value = true
  applyRouteQuery()
  emitter.on('item_tags_updated', itemTagsUpdatedHandler)
  emitter.on('items_tags_updated', itemsTagsUpdatedHandler)
  emitter.on('sms_sent' as any, smsSentHandler)
})

onDeactivated(() => {
  isActive.value = false
  emitter.off('item_tags_updated', itemTagsUpdatedHandler)
  emitter.off('items_tags_updated', itemsTagsUpdatedHandler)
  emitter.off('sms_sent' as any, smsSentHandler)
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
<style scoped lang="scss">
.chat-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
  min-height: 56px;
  box-sizing: border-box;
}

.chat-header-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.chat-header-name {
  font-weight: 500;
  font-size: 1rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-header-address {
  font-size: 0.75rem;
  color: var(--md-sys-color-on-surface-variant);
}

.chat-header-actions {
  display: flex;
  gap: 4px;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.chat-loading {
  display: flex;
  justify-content: center;
  align-items: center;
  flex: 1;
}

.chat-date-separator {
  display: flex;
  justify-content: center;
  margin: 16px 0 8px;

  span {
    font-size: 0.75rem;
    color: var(--md-sys-color-on-surface-variant);
    background: var(--md-sys-color-surface-container-high);
    padding: 4px 12px;
    border-radius: 12px;
  }
}

.chat-bubble-row {
  display: flex;
  flex-direction: column;
  max-width: 75%;

  &.sent {
    align-self: flex-end;
    align-items: flex-end;

    .chat-bubble {
      background: var(--md-sys-color-primary-container);
      color: var(--md-sys-color-on-primary-container);
      border-radius: 16px 16px 4px 16px;
    }
  }

  &.received {
    align-self: flex-start;
    align-items: flex-start;

    .chat-bubble {
      background: var(--md-sys-color-surface-container-high);
      color: var(--md-sys-color-on-surface);
      border-radius: 16px 16px 16px 4px;
    }
  }
}

.chat-bubble {
  padding: 10px 14px;
  font-size: 0.9375rem;
  line-height: 1.5;
  word-break: break-word;
  white-space: pre-wrap;
}

.chat-attachments {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chat-attachment-image,
.chat-attachment-video {
  max-width: min(360px, 100%);
  border-radius: 12px;
  display: block;
}

.chat-attachment-audio {
  width: min(360px, 100%);
}

.chat-attachment-link {
  display: inline-flex;
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.chat-time {
  font-size: 0.6875rem;
  color: var(--md-sys-color-on-surface-variant);
  margin-top: 2px;
  padding-inline: 4px;
}

.chat-input-bar {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 8px 16px 12px;
  border-top: 1px solid var(--md-sys-color-outline-variant);
}

.chat-input-field {
  flex: 1;
}

.chat-send-btn {
  flex-shrink: 0;
  margin-bottom: 4px;
}

.chat-bubble-with-actions {
  display: flex;
  align-items: flex-start;
  gap: 4px;

  .chat-tag-btn {
    opacity: 0;
    transition: opacity 0.15s ease;
    flex-shrink: 0;
    align-self: center;
  }
}

.chat-bubble-row {
  &:hover .chat-tag-btn {
    opacity: 1;
  }

  &.sent .chat-bubble-with-actions {
    flex-direction: row-reverse;
  }
}

.chat-bubble-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
  padding-inline: 4px;
}

.chat-tag-chip {
  font-size: 0.6875rem;
  color: var(--md-sys-color-on-secondary-container);
  background: var(--md-sys-color-secondary-container);
  padding: 2px 8px;
  border-radius: 10px;
  white-space: nowrap;
}
</style>
