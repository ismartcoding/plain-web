<template>
  <SidebarListItem :title="channel.name" :subtitle="subtitle" :active="active" @click="emit('click')">
    <template #start>
      <span class="icon" aria-hidden="true">
        <i-lucide:hash />
      </span>
    </template>

    <template #end>
      <span v-if="time" v-tooltip="formatDateTime(time)" class="chat-time">{{ formatTimeAgo(time) }}</span>
    </template>
    <template #actions>
      <v-icon-button :id="anchorId" v-tooltip="$t('actions')" class="sm" @click.prevent.stop="showMenu">
        <i-material-symbols:more-vert />
      </v-icon-button>
      <v-dropdown-menu v-model="menuVisible" :anchor="anchorId">
        <template v-if="!confirmingDelete">
          <div class="dropdown-item" @click="confirmingDelete = true">
            {{ $t('delete_channel') }}
          </div>
        </template>
        <template v-else>
          <inline-delete-confirm :name="channel.name" :loading="deleteLoading" @confirm="doDelete" @cancel="confirmingDelete = false" />
        </template>
      </v-dropdown-menu>
    </template>
  </SidebarListItem>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useMainStore } from '@/stores/main'
import { useChatStore } from '@/stores/chat'
import { useTempStore } from '@/stores/temp'
import { replacePath } from '@/plugins/router'
import { deleteChatChannelGQL, initMutation } from '@/lib/api/mutation'
import { formatDateTime, formatTimeAgo } from '@/lib/format'
import { decryptChatId } from '../hooks/chat-route'

const props = defineProps<{
  channel: { id: string; name: string }
  subtitle?: string
  active?: boolean
  time?: string
}>()

const emit = defineEmits<{
  (e: 'click'): void
}>()

const router = useRouter()
const mainStore = useMainStore()
const chatStore = useChatStore()
const { urlTokenKey } = storeToRefs(useTempStore())

const currentChatId = computed(() => {
  if (router.currentRoute.value.path.includes('app-files')) return ''
  const qid = router.currentRoute.value.query.id
  const enc = typeof qid === 'string' && qid !== '' ? qid : ''
  return decryptChatId(enc, urlTokenKey.value)
})

const anchorId = computed(() => `channel-list-${props.channel.id}`)

const menuVisible = ref(false)
const confirmingDelete = ref(false)
const deleteLoading = ref(false)

watch(menuVisible, (v) => {
  if (!v) confirmingDelete.value = false
})

function showMenu() {
  const anchorElement = document.getElementById(anchorId.value)
  document.dispatchEvent(new CustomEvent('dropdown-toggle', { detail: { exclude: anchorElement } }))
  menuVisible.value = true
}

const { mutate: deleteChannel } = initMutation({ document: deleteChatChannelGQL })

function doDelete() {
  if (deleteLoading.value) return
  deleteLoading.value = true
  const wasActive = currentChatId.value === `channel:${props.channel.id}`
  deleteChannel({ id: props.channel.id }).then((result) => {
    deleteLoading.value = false
    if (!result) return
    chatStore.removeChannel(props.channel.id)
    chatStore.fetchChannels()
    chatStore.fetchLatestChatItems()
    menuVisible.value = false
    if (wasActive) replacePath(mainStore, '/chat')
  })
}
</script>

<style lang="scss" scoped>
.icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
}

.chat-time {
  font-size: 0.75rem;
  opacity: 0.78;
}
</style>
