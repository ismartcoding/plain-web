<!-- eslint-disable vue/no-v-html -->
<template>
  <div
    class="chat-bubble-row"
    :class="{ sent: isSent, received: !isSent }"
  >
    <div class="chat-bubble-with-actions">
      <v-icon-button
        v-if="!isDraftOrPending"
        v-tooltip="$t('add_to_tags')"
        class="chat-tag-btn"
        @click.stop="$emit('addToTags', item)"
      >
        <i-material-symbols:label-outline-rounded />
      </v-icon-button>
      <div class="chat-bubble">
        <div v-if="item.body" v-html="addLinksToURLs(item.body)"></div>
        <div v-if="item.attachments?.length" class="chat-attachments">
          <template v-for="(att, idx) in item.attachments" :key="`${item.id}-att-${idx}`">
            <img v-if="att.contentType.startsWith('image/')" class="chat-attachment-image" :src="resolveUrl(att.path)" :alt="att.name || 'mms-image'" />
            <video v-else-if="att.contentType.startsWith('video/')" class="chat-attachment-video" :src="resolveUrl(att.path)" controls preload="metadata" />
            <audio v-else-if="att.contentType.startsWith('audio/')" class="chat-attachment-audio" :src="resolveUrl(att.path)" controls preload="metadata" />
            <a v-else class="chat-attachment-link" :href="resolveUrl(att.path)" target="_blank" rel="noopener noreferrer">
              {{ att.name || att.contentType || att.path }}
            </a>
          </template>
        </div>
      </div>
    </div>
    <div v-if="item.tags?.length" class="chat-bubble-tags">
      <span v-for="tag in item.tags" :key="tag.id" class="chat-tag-chip">{{ tag.name }}</span>
    </div>
    <span class="chat-time" v-tooltip="formatDateTime(item.date)">{{ formatTime(item.date) }}</span>
    <span v-if="isDraftOrPending" class="chat-pending-status" :class="{ failed: pendingFailed }">
      <i-material-symbols:error-outline-rounded v-if="pendingFailed" class="pending-error-icon" />
      {{ pendingFailed ? $t('mms_cancelled') : $t('message_type.3') }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { IMessage } from '@/lib/interfaces'
import { formatDateTime, formatTime } from '@/lib/format'
import { addLinksToURLs } from '@/lib/strutil'
import { getFileUrlByPath } from '@/lib/api/file'

const props = defineProps<{
  item: IMessage
  urlTokenKey: Uint8Array | null
}>()

defineEmits<{
  addToTags: [item: IMessage]
}>()

const isSent = computed(() => props.item.type === 2 || props.item.type === 4)
const isDraftOrPending = computed(() =>
  props.item.id.startsWith('pending_sms') || props.item.id.startsWith('pending_mms') || props.item.type === 3,
)
const pendingFailed = computed(() => {
  if (!props.item.id.startsWith('pending_mms')) return false
  return Date.now() - new Date(props.item.date).getTime() > 5 * 60 * 1000
})

function resolveUrl(path: string): string {
  if (path.startsWith('blob:') || path.startsWith('data:')) return path
  return getFileUrlByPath(props.urlTokenKey, path)
}
</script>

<style scoped lang="scss">
.chat-bubble-row {
  display: flex;
  flex-direction: column;
  max-width: 75%;
  .chat-bubble { background: var(--md-sys-color-surface-container-high); color: var(--md-sys-color-on-surface); }
  &.sent { align-self: flex-end; align-items: flex-end; .chat-bubble { border-radius: 16px 16px 4px 16px; } }
  &.received { align-self: flex-start; align-items: flex-start; .chat-bubble { border-radius: 16px 16px 16px 4px; } }
  &:hover .chat-tag-btn { opacity: 1; }
  &.sent .chat-bubble-with-actions { flex-direction: row-reverse; }
}
.chat-bubble { padding: 10px 14px; font-size: 0.9375rem; line-height: 1.5; word-break: break-word; white-space: pre-wrap; }
.chat-attachments { margin-top: 8px; display: flex; flex-direction: column; gap: 8px; }
.chat-attachment-image, .chat-attachment-video { max-width: min(360px, 100%); border-radius: 12px; display: block; }
.chat-attachment-audio { width: min(360px, 100%); }
.chat-attachment-link { display: inline-flex; color: inherit; text-decoration: underline; text-underline-offset: 2px; }
.chat-time { font-size: 0.6875rem; color: var(--md-sys-color-on-surface-variant); margin-top: 2px; padding-inline: 4px; }
.chat-pending-status {
  display: flex; align-items: center; gap: 4px; font-size: 0.6875rem;
  color: var(--md-sys-color-on-surface-variant); padding-inline: 4px; margin-top: 2px;
  &.failed { color: var(--md-sys-color-error); }
  .pending-error-icon { font-size: 14px; }
}
.chat-bubble-with-actions {
  display: flex; align-items: flex-start; gap: 4px;
  .chat-tag-btn { opacity: 0; transition: opacity 0.15s ease; flex-shrink: 0; align-self: center; }
}
.chat-bubble-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; padding-inline: 4px; }
.chat-tag-chip {
  font-size: 0.6875rem; color: var(--md-sys-color-on-secondary-container);
  background: var(--md-sys-color-secondary-container); padding: 2px 8px; border-radius: 10px; white-space: nowrap;
}
</style>
