<template>
  <left-sidebar>
    <template #body>
      <ul class="nav">
        <li :class="{ active: currentChatId === 'local' }" @click.prevent="openChat('local')">
          <span class="icon" aria-hidden="true"><i-lucide:bot /></span>
          <span class="title">{{ $t('page_title.local_chat') }}</span>
        </li>
      </ul>

      <template v-if="loading">
        <div class="sidebar-loading">
          <v-circular-progress indeterminate class="sm" />
        </div>
      </template>
      <template v-else>
        <div class="section-title">
          {{ $t('channels') }}
          <v-icon-button v-tooltip="$t('create_channel')" class="sm" @click="openCreateChannel">
            <i-material-symbols:add-rounded />
          </v-icon-button>
        </div>
        <ul class="nav">
          <li
            v-for="channel in joinedChannels"
            :key="channel.id"
            :class="{ active: isChannelActive(channel.id) }"
            @click.prevent="openChat(getChannelChatRouteId(channel.id))"
          >
            <span class="icon" aria-hidden="true"><i-lucide:hash /></span>
            <span class="title">{{ channel.name }}</span>
          </li>
        </ul>

        <template v-if="pairedPeers.length > 0">
          <div class="section-title">{{ $t('paired_devices') }}</div>
          <ul class="nav">
            <li
              v-for="peer in pairedPeers"
              :key="peer.id"
              :class="{ active: isPeerActive(peer.id) }"
              @click.prevent="openChat(getPeerChatRouteId(peer.id))"
            >
              <span class="icon" aria-hidden="true">
                <i-lucide:smartphone v-if="peer.deviceType === 'phone'" />
                <i-lucide:tablet v-else-if="peer.deviceType === 'tablet'" />
                <i-lucide:laptop v-else-if="peer.deviceType === 'pc'" />
                <i-lucide:monitor v-else />
              </span>
              <span class="title">{{ peer.name }}</span>
              <span class="subtitle">{{ peer.ip }}</span>
            </li>
          </ul>
        </template>

        <template v-if="unpairedPeers.length > 0">
          <div class="section-title">{{ $t('unpaired_devices') }}</div>
          <ul class="nav">
            <li
              v-for="peer in unpairedPeers"
              :key="peer.id"
              :class="{ active: isPeerActive(peer.id) }"
              @click.prevent="openChat(getPeerChatRouteId(peer.id))"
            >
              <span class="icon" aria-hidden="true">
                <i-lucide:smartphone v-if="peer.deviceType === 'phone'" />
                <i-lucide:tablet v-else-if="peer.deviceType === 'tablet'" />
                <i-lucide:laptop v-else-if="peer.deviceType === 'pc'" />
                <i-lucide:monitor v-else />
              </span>
              <span class="title">{{ peer.name }}</span>
              <span class="subtitle">{{ peer.ip }}</span>
            </li>
          </ul>
        </template>
      </template>
    </template>
  </left-sidebar>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useMainStore } from '@/stores/main'
import { useTempStore } from '@/stores/temp'
import { storeToRefs } from 'pinia'
import { replacePath } from '@/plugins/router'
import { initLazyQuery, peersGQL, chatChannelsGQL } from '@/lib/api/query'
import type { IPeer, IChatChannel } from '@/lib/interfaces'
import { getFileId } from '@/lib/api/file'
import { chachaDecrypt } from '@/lib/api/crypto'
import { openModal } from '@/components/modal'
import CreateChannelModal from './CreateChannelModal.vue'
import ChannelInviteModal from './ChannelInviteModal.vue'
import emitter from '@/plugins/eventbus'
import * as sjcl from 'sjcl'

const router = useRouter()
const mainStore = useMainStore()
const tempStore = useTempStore()
const { urlTokenKey } = storeToRefs(tempStore)
const peers = ref<IPeer[]>([])
const channels = ref<IChatChannel[]>([])

const currentEncryptedId = computed(() => {
  const qid = router.currentRoute.value.query.id
  return typeof qid === 'string' && qid !== '' ? qid : ''
})

const currentChatId = computed(() => {
  if (!currentEncryptedId.value) return 'local'
  if (!urlTokenKey.value) return ''

  try {
    const bits = sjcl.codec.base64.toBits(currentEncryptedId.value)
    const decrypted = chachaDecrypt(urlTokenKey.value, bits)
    if (decrypted.startsWith('peer:') || decrypted.startsWith('channel:')) return decrypted
    return 'local'
  } catch {
    return 'local'
  }
})

const pairedPeers = computed(() => peers.value.filter((p) => p.status === 'paired'))
const unpairedPeers = computed(() => peers.value.filter((p) => p.status === 'unpaired'))

const joinedChannels = computed(() => channels.value.filter((c) => c.status === 'joined'))

function getPeerChatRouteId(peerId: string) {
  return getFileId(urlTokenKey.value, `peer:${peerId}`)
}

function getChannelChatRouteId(channelId: string) {
  return getFileId(urlTokenKey.value, `channel:${channelId}`)
}

function isPeerActive(peerId: string) {
  return currentChatId.value === `peer:${peerId}`
}

function isChannelActive(channelId: string) {
  return currentChatId.value === `channel:${channelId}`
}

const { fetch: fetchPeers, loading } = initLazyQuery({
  handle: (data: { peers: IPeer[] }) => {
    if (data?.peers) {
      peers.value = data.peers
    }
  },
  document: peersGQL,
  variables: () => ({}),
})

const { fetch: fetchChannels } = initLazyQuery({
  handle: (data: { chatChannels: IChatChannel[] }) => {
    if (data?.chatChannels) {
      channels.value = data.chatChannels.map((c: any) => ({ ...c }))
    }
  },
  document: chatChannelsGQL,
  variables: () => ({}),
})

function openChat(id: string) {
  if (id === 'local') {
    replacePath(mainStore, '/chat')
    return
  }
  replacePath(mainStore, `/chat?id=${encodeURIComponent(id)}`)
}

function openCreateChannel() {
  openModal(CreateChannelModal, {
    onCreated: (channel: IChatChannel) => {
      channels.value = [...channels.value, { ...channel }].sort((a, b) => a.name.localeCompare(b.name))
      openChat(getChannelChatRouteId(channel.id))
    },
  })
}

const _handlers: Record<string, (...args: any[]) => any> = {}

onMounted(() => {
  fetchPeers()
  fetchChannels()

  _handlers.channels_updated = (data: any[]) => {
    if (data) {
      channels.value = data.map((c: any) => ({ ...c }))
    }
  }
  emitter.on('channels_updated', _handlers.channels_updated)
})

onUnmounted(() => {
  Object.entries(_handlers).forEach(([event, fn]) => {
    emitter.off(event as any, fn)
  })
})
</script>

<style lang="scss" scoped>
.sidebar-loading {
  display: flex;
  justify-content: center;
  padding: 16px;
}

.subtitle {
  font-size: 0.75rem;
  color: var(--md-sys-color-on-surface-variant);
  margin-left: auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
