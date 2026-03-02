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
        <v-icon-button v-tooltip="$t('export_sms')" @click.stop="openExport">
          <i-material-symbols:download-rounded />
        </v-icon-button>
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
                v-if="!isDraftOrPending(item)"
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
            <span v-if="isDraftOrPending(item)" class="chat-pending-status" :class="{ failed: isPendingFailed(item) }">
              <i-material-symbols:error-outline-rounded v-if="isPendingFailed(item)" class="pending-error-icon" />
              {{ isPendingFailed(item) ? $t('mms_cancelled') : $t('message_type.3') }}
            </span>
          </div>
        </div>
      </template>
      <div v-if="!detailLoading && items.length === 0" class="no-data-placeholder">
        {{ $t(noDataKey(loading, app.permissions, 'READ_SMS')) }}
      </div>
    </div>
    <div class="chat-input-bar">
      <div v-if="pendingFiles.length" class="chat-attachment-preview">
        <div v-for="(file, idx) in pendingFiles" :key="idx" class="chat-attachment-preview-item">
          <img v-if="file.type.startsWith('image/')" :src="filePreviewUrl(file)" class="chat-preview-thumb" />
          <div v-else class="chat-preview-file">
            <i-material-symbols:attach-file-rounded />
          </div>
          <span class="chat-preview-name">{{ file.name }}</span>
          <span class="chat-preview-size" :class="{ warn: !file.type.startsWith('image/') && file.size > MMS_WARN_SIZE }">{{ formatFileSize(file.size) }}</span>
          <v-icon-button class="chat-preview-remove" @click="removePendingFile(idx)">
            <i-material-symbols:close-rounded />
          </v-icon-button>
        </div>
        <div v-if="hasLargeNonImageFile" class="chat-size-warning">
          <i-material-symbols:warning-outline-rounded />
          {{ $t('mms_large_file_warning') }}
        </div>
        <div v-else-if="totalPendingSize > MMS_WARN_SIZE" class="chat-size-hint">
          {{ $t('mms_image_auto_compress') }}
        </div>
      </div>
      <div class="chat-input-row">
        <input ref="fileInputRef" type="file" multiple accept="image/*,video/*,audio/*" class="hidden-file-input" @change="onFileSelected" />
        <v-text-field
          v-model="messageBody"
          type="textarea"
          :rows="1"
          :placeholder="$t('write_a_message')"
          class="chat-input-field"
          @keydown.enter.exact.prevent="sendMessage"
        >
          <template #leading-icon>
            <v-icon-button v-tooltip="$t('attachments')" @click="openFilePicker">
              <i-material-symbols:attach-file-rounded />
            </v-icon-button>
          </template>
          <template #trailing-icon>
            <v-icon-button class="btn-send" :disabled="sendLoading || mmsUploading" @click="sendMessage">
              <i-material-symbols:send-rounded />
            </v-icon-button>
          </template>
        </v-text-field>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, onActivated, onDeactivated, onUnmounted, ref, watch } from 'vue'
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
import ExportSmsModal from '@/components/messages/ExportSmsModal.vue'
import UpdateTagRelationsModal from '@/components/UpdateTagRelationsModal.vue'
import { DataType } from '@/lib/data'
import { callGQL, initMutation, sendSmsGQL, sendMmsGQL } from '@/lib/api/mutation'
import tapPhone from '@/plugins/tapphone'
import { buildQuery } from '@/lib/search'
import { useContactName } from '@/hooks/contacts'
import { formatDateTime, formatTime } from '@/lib/format'
import { addLinksToURLs, shortUUID } from '@/lib/strutil'
import { getFileUrlByPath } from '@/lib/api/file'
import { upload as uploadFile } from '@/lib/upload/upload'
import type { IUploadItem } from '@/stores/temp'

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
const fileInputRef = ref<HTMLInputElement>()
const pendingFiles = ref<File[]>([])
const mmsUploading = ref(false)
const pendingMmsItem = ref<IMessage | null>(null)
const pendingSmsItem = ref<IMessage | null>(null)
let pendingSmsPreCount = 0
let lastMmsSendBody = ''
let lastMmsSendAddress = ''
const { tags, fetch: fetchTags } = useTags(dataType)

// MMS size constants — images are auto-compressed on the server, but
// video/audio cannot be compressed and will fail if too large.
const MMS_WARN_SIZE = 300 * 1024 // 300 KB — conservative carrier minimum

const totalPendingSize = computed(() => pendingFiles.value.reduce((s, f) => s + f.size, 0))
const hasLargeNonImageFile = computed(() =>
  pendingFiles.value.some((f) => !f.type.startsWith('image/') && f.size > MMS_WARN_SIZE)
)

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

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
  const base = [...items.value].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  // Only add in-memory pending items if the backend hasn't returned them yet
  const pending: IMessage[] = []
  if (pendingSmsItem.value && !base.some((it) => it.id === pendingSmsItem.value?.id)) {
    pending.push(pendingSmsItem.value)
  }
  if (pendingMmsItem.value && !base.some((it) => it.id === pendingMmsItem.value?.id)) {
    pending.push(pendingMmsItem.value)
  }
  return pending.length ? [...base, ...pending] : base
})

function isSent(item: IMessage): boolean {
  // type 2 = sent, 4 = outbox
  return item.type === 2 || item.type === 4
}

function isDraftOrPending(item: IMessage): boolean {
  // In-memory placeholder created by this app, or a type=3 draft from the DB
  return item.id.startsWith('pending_sms') || item.id.startsWith('pending_mms') || item.type === 3
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
  // Blob/data URLs (used for the pending MMS preview) are already absolute
  if (path.startsWith('blob:') || path.startsWith('data:')) return path
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
      // Clear the in-memory SMS pending item once the backend confirms the new message
      if (pendingSmsItem.value && data.sms.length > pendingSmsPreCount) {
        pendingSmsItem.value = null
      }
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

const { mutate: mutateSendMms, onDone: onSendMmsDone } = initMutation({
  document: sendMmsGQL,
})

// Android's SmsManager.sendTextMessage() is fire-and-forget: the mutation
// returns as soon as the message is queued with the modem.  The OS writes
// the sent SMS to the content provider asynchronously (typically 1-3 s).
// We therefore retry the refetch a few times with increasing delays so the
// new message shows up without requiring a manual page refresh.
function refetchWithRetry() {
  const previousCount = items.value.length
  const delays = [1000, 2000, 3000]
  let attempt = 0

  function tryFetch() {
    fetch()
    attempt++
    if (attempt < delays.length) {
      setTimeout(() => {
        // If the item count hasn't changed, try again
        if (items.value.length <= previousCount) {
          tryFetch()
        }
      }, delays[attempt])
    }
  }

  // First attempt after a short delay to give the OS time to persist
  setTimeout(tryFetch, delays[0])
}

onSendDone(() => {
  refetchWithRetry()
})

onSendMmsDone((result: any) => {
  // Use the pending ID returned by the backend so the in-memory placeholder
  // and the backend-stored entry share the same ID.
  const pendingId: string = result?.data?.sendMms ?? ('pending_mms_' + Date.now())
  // Capture blob preview URLs before clearing pendingFiles
  const pendingAttachments = pendingFiles.value.map((file) => ({
    path: URL.createObjectURL(file),
    contentType: file.type || 'application/octet-stream',
    name: file.name,
  }))
  pendingMmsItem.value = {
    id: pendingId,
    body: lastMmsSendBody,
    address: lastMmsSendAddress,
    serviceCenter: '',
    date: new Date().toISOString(),
    type: 3, // draft, since it's not sent yet
    threadId: threadId.value,
    subscriptionId: -1,
    isMms: true,
    attachments: pendingAttachments,
    tags: [],
  }
  messageBody.value = ''
  pendingFiles.value = []
  tapPhone(t('confirm_mms_on_phone'))
  scrollToBottom()
  // Immediately fetch so the backend-stored pending entry replaces the in-memory one
  fetch()
})

function openFilePicker() {
  fileInputRef.value?.click()
}

function onFileSelected(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files) {
    pendingFiles.value = [...pendingFiles.value, ...Array.from(input.files)]
  }
  // reset so the same file can be re-selected
  input.value = ''
}

function removePendingFile(index: number) {
  pendingFiles.value = pendingFiles.value.filter((_, i) => i !== index)
}

function filePreviewUrl(file: File): string {
  return URL.createObjectURL(file)
}

async function uploadAttachments(): Promise<string[]> {
  const paths: string[] = []
  const mmsDir = `${app.value.appDir}/mms_tmp`
  for (const file of pendingFiles.value) {
    const item: IUploadItem = {
      id: shortUUID(),
      dir: mmsDir,
      fileName: file.name,
      file,
      status: 'pending',
      uploadedSize: 0,
      error: '',
      isAppFile: false,
    }
    const result = await uploadFile(item, false) as { fileName?: string; error?: string } | undefined
    if (result && result.fileName) {
      paths.push(`${mmsDir}/${result.fileName}`)
    } else {
      throw new Error(t('upload_failed'))
    }
  }
  return paths
}

async function sendMessage() {
  const body = messageBody.value.trim()
  const address = items.value[0]?.address
  if ((!body && pendingFiles.value.length === 0) || !address) return

  // If there are attachments, send as MMS
  if (pendingFiles.value.length > 0) {
    mmsUploading.value = true
    try {
      const attachmentPaths = await uploadAttachments()
      lastMmsSendBody = body
      lastMmsSendAddress = address
      mutateSendMms({ number: address, body: body || '', attachmentPaths, threadId: threadId.value })
    } catch (e: any) {
      toast(e.message || t('upload_failed'), 'error')
    } finally {
      mmsUploading.value = false
    }
  } else {
    // Plain SMS
    if (!body) return
    pendingSmsPreCount = items.value.length
    mutateSendSms({ number: address, body })
    // Immediately show a pending bubble for better UX
    pendingSmsItem.value = {
      id: 'pending_sms_' + Date.now(),
      body,
      address,
      serviceCenter: '',
      date: new Date().toISOString(),
      type: 2, // sent
      threadId: threadId.value,
      subscriptionId: -1,
      isMms: false,
      attachments: [],
      tags: [],
    }
    messageBody.value = ''
    scrollToBottom()
  }
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

function openExport() {
  openModal(ExportSmsModal, {
    items: [...sortedItems.value],
    contactName: contactName.value,
    urlTokenKey: urlTokenKey.value,
  })
}

function backToList() {
  const q = route.query.q
  replacePath(mainStore, q ? `/messages?q=${q}` : `/messages`)
}


function isPendingFailed(item: IMessage): boolean {
  // Only in-memory pending items can time out; DB drafts (type=3) are just drafts.
  if (!item.id.startsWith('pending_mms')) return false
  // Show as failed (cancelled) if the pending MMS is older than 5 minutes.
  // This also handles the page-refresh case where no timer is running.
  return (Date.now() - new Date(item.date).getTime()) > 5 * 60 * 1000
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

// When the backend-stored pending entry appears in items, discard the in-memory placeholder.
watch(items, (newItems) => {
  if (pendingMmsItem.value && newItems.some((it) => it.id === pendingMmsItem.value?.id)) {
    pendingMmsItem.value = null
  }
})

const isActive = ref(false)

function applyRouteQuery() {
  const tid = route.params.threadId
  threadId.value = typeof tid === 'string' ? tid : (Array.isArray(tid) ? tid[0] : '')
  if (!threadId.value) {
    items.value = []
    detailLoading.value = false
    return
  }
  // Clear in-memory pending MMS when navigating to a different thread
  pendingMmsItem.value = null
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
})

onDeactivated(() => {
  isActive.value = false
  emitter.off('item_tags_updated', itemTagsUpdatedHandler)
  emitter.off('items_tags_updated', itemsTagsUpdatedHandler)
})

onUnmounted(() => {
  // nothing to clean up
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
  .chat-bubble {
    background: var(--md-sys-color-surface-container-high);
    color: var(--md-sys-color-on-surface);
  }
  &.sent {
    align-self: flex-end;
    align-items: flex-end;

    .chat-bubble {
      border-radius: 16px 16px 4px 16px;
    }
  }

  &.received {
    align-self: flex-start;
    align-items: flex-start;

    .chat-bubble {
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

.chat-pending-status {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.6875rem;
  color: var(--md-sys-color-on-surface-variant);
  padding-inline: 4px;
  margin-top: 2px;

  &.failed {
    color: var(--md-sys-color-error);
  }

  .pending-error-icon {
    font-size: 14px;
  }
}

.chat-input-bar {
  display: flex;
  flex-direction: column;
  padding: 8px 16px 12px;
  border-top: 1px solid var(--md-sys-color-outline-variant);
}

.chat-input-row {
  display: flex;
  align-items: flex-end;

  .hidden-file-input {
    display: none;
  }

  .chat-input-field {
    flex: 1;
  }

  .btn-send {
    margin-block-start: 4px;
  }
}

.chat-attachment-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-bottom: 8px;
}

.chat-attachment-preview-item {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--md-sys-color-surface-container-high);
  border-radius: 8px;
  padding: 4px 8px;
  max-width: 200px;
}

.chat-preview-thumb {
  width: 32px;
  height: 32px;
  object-fit: cover;
  border-radius: 4px;
  flex-shrink: 0;
}

.chat-preview-file {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  flex-shrink: 0;
  color: var(--md-sys-color-on-surface-variant);
}

.chat-preview-name {
  font-size: 0.75rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.chat-preview-remove {
  flex-shrink: 0;
}

.chat-preview-size {
  font-size: 0.6875rem;
  color: var(--md-sys-color-on-surface-variant);
  flex-shrink: 0;
  &.warn {
    color: var(--md-sys-color-error);
    font-weight: 500;
  }
}

.chat-size-warning {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  color: var(--md-sys-color-error);
  padding: 4px 0;
}

.chat-size-hint {
  font-size: 0.75rem;
  color: var(--md-sys-color-on-surface-variant);
  padding: 4px 0;
  width: 100%;
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
