<!-- eslint-disable vue/no-v-html -->
<template>
  <div class="chat-item">
    <div v-if="showDate" class="date">{{ formatDate(data.createdAt) }}</div>
    <v-dropdown v-model="open">
      <template #trigger>
        <div class="chat-title">
          <span class="name">{{ senderName }}</span>
          <time v-tooltip="formatDateTimeFull(data.createdAt)" class="time">{{ formatTime(data.createdAt) }}</time>
          <span v-if="data.id.startsWith('new_') && data.status !== 'failed'" class="sending">{{ sendingStatus }}</span>
          <span
            v-else-if="data.fromId === 'me' && (data.status === 'failed' || data.status === 'partial')"
            class="send-error"
            @click.stop="emit('retry', data.id, data.statusData)"
          >
            <i-lucide:rotate-ccw class="send-error-icon" />
            {{ deliveryLabel }}
          </span>
          <i-material-symbols:expand-more-rounded class="bi bi-more" />
        </div>
      </template>
      <div class="dropdown-item" :class="{ disabled: deleteLoading }" @click="emit('delete', data.id); open = false">
        {{ $t('delete_message') }}
      </div>
    </v-dropdown>
    <div class="chat-content">
      <div v-if="data._content.type === 'text'">
        <pre v-html="addLinksToURLs(data._content.value.text)"></pre>
        <ChatLinkPreviews v-if="data._content.value.linkPreviews?.length" :data="data" />
      </div>
      <component :is="getComponent(data._content.type)" v-else :data="data" :download-info="downloadInfo" :peer="peer" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatTime, formatDateTimeFull, formatDate } from '@/lib/format'
import { addLinksToURLs } from '@/lib/strutil'
import ChatImages from './ChatImages.vue'
import ChatLinkPreviews from './ChatLinkPreviews.vue'
import ChatFiles from './ChatFiles.vue'
import type { IChatItem, IPeer } from '@/lib/interfaces'

const props = defineProps<{
  data: IChatItem
  showDate: boolean
  senderName: string
  sendingStatus: string
  deleteLoading: boolean
  downloadInfo: { downloaded: number; total: number; speed: number; status: string } | null
  peer: IPeer | null
}>()

const emit = defineEmits<{ delete: [id: string]; retry: [id: string, statusData?: string] }>()
const open = ref(false)
const { t } = useI18n()

const deliveryLabel = computed(() => {
  if (props.data.channelId && props.data.statusData) {
    try {
      const sd = JSON.parse(props.data.statusData) as { results?: Array<{ error?: string | null }> }
      if (sd.results?.length) {
        const delivered = sd.results.filter((r) => !r.error).length
        return `${delivered}/${sd.results.length}`
      }
    } catch { /* */ }
  }
  return t('delivery_failed')
})

const componentMap: Record<string, any> = { images: ChatImages, files: ChatFiles, linkPreviews: ChatLinkPreviews }
function getComponent(type: string) { return componentMap[type] }
</script>
