<!-- eslint-disable vue/no-v-html -->
<template>
  <div class="chat-item">
    <div v-if="showDate" class="date">{{ formatDate(data.createdAt) }}</div>
    <v-dropdown v-model="open">
      <template #trigger>
        <div class="chat-title">
          <span class="name">{{ senderName }}</span>
          <time v-tooltip="formatDateTimeFull(data.createdAt)" class="time">{{ formatTime(data.createdAt) }}</time>
          <span v-if="showSending" class="sending">{{ sendingStatus }}</span>
          <span
            v-else-if="data.fromId === 'me' && (data.status === ChatStatus.FAILED || data.status === ChatStatus.PARTIAL)"
            :id="errorAnchorId"
            class="send-error"
            @click.prevent.stop="showErrorMenu"
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
    <v-dropdown-menu v-model="statusMenuOpen" :anchor="errorAnchorId">
      <div class="status-header">
        <i-material-symbols:error-outline-rounded class="status-header-icon" />
        <span>{{ $t('delivery_status') }}</span>
      </div>
      <div v-if="deliveryResults.length > 0" class="status-body">
        <div v-if="deliveryResults.length > 1" class="status-summary">
          {{ $t('delivery_status_summary', { delivered: deliveredCount, total: deliveryResults.length }) }}
        </div>
        <div v-for="r in deliveryResults" :key="r.peerId" class="status-peer">
          <i-material-symbols:check-rounded v-if="!r.error" class="status-icon ok" />
          <i-material-symbols:error-outline-rounded v-else class="status-icon fail" />
          <span class="status-peer-name">{{ r.peerName }}</span>
          <span v-if="r.error" class="status-peer-error">{{ r.error }}</span>
        </div>
      </div>
      <div v-else class="status-error">{{ errorMessage }}</div>
      <div class="dropdown-item" @click="doRetry">
        <i-lucide:rotate-ccw class="status-retry-icon" />
        {{ $t('try_again') }}
      </div>
    </v-dropdown-menu>
    <div class="chat-content">
      <div v-if="data._content.type === MessageType.TEXT">
        <pre v-html="addLinksToURLs(data._content.value.text)"></pre>
        <ChatLinkPreviews v-if="data._content.value.linkPreviews?.length" :data="data" />
      </div>
      <component :is="getComponent(data._content.type)" v-else :data="data" :download-info="downloadInfo" :peer="peer" @download-action="(a: 'pause' | 'resume' | 'retry') => emit('download-action', data.id, a)" />
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
import { ChatStatus, MessageType } from '@/lib/status'

const props = defineProps<{
  data: IChatItem
  showDate: boolean
  senderName: string
  sendingStatus: string
  deleteLoading: boolean
  downloadInfo: { downloaded: number; total: number; speed: number; status: string } | null
  peer: IPeer | null
}>()

const emit = defineEmits<{ delete: [id: string]; retry: [id: string, statusData?: string]; 'download-action': [id: string, action: 'pause' | 'resume' | 'retry'] }>()
const open = ref(false)
const statusMenuOpen = ref(false)
const { t } = useI18n()

const errorAnchorId = computed(() => `msg-error-${props.data.id}`)

const showSending = computed(() => {
  if (props.data.fromId !== 'me') return false
  if (props.data.status === ChatStatus.PENDING) return true
  return props.data.id.startsWith('new_') && props.data.status !== ChatStatus.FAILED
})

interface DeliveryResult {
  peerId: string
  peerName: string
  error?: string | null
}

const deliveryResults = computed<DeliveryResult[]>(() => {
  if (!props.data.statusData) return []
  try {
    const sd = JSON.parse(props.data.statusData) as { results?: DeliveryResult[] }
    return sd.results ?? []
  } catch {
    return []
  }
})

const deliveredCount = computed(() => deliveryResults.value.filter((r) => !r.error).length)
const errorMessage = computed(() => deliveryResults.value[0]?.error || t('send_failed'))

function showErrorMenu() {
  document.dispatchEvent(new CustomEvent('dropdown-toggle', { detail: { exclude: document.getElementById(errorAnchorId.value) } }))
  statusMenuOpen.value = true
}

function doRetry() {
  statusMenuOpen.value = false
  emit('retry', props.data.id, props.data.statusData)
}

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

const componentMap: Record<string, any> = { [MessageType.IMAGES]: ChatImages, [MessageType.FILES]: ChatFiles, linkPreviews: ChatLinkPreviews }
function getComponent(type: string) { return componentMap[type] }
</script>
