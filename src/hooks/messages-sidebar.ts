import { onActivated, onDeactivated, ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { replacePath } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import { useTempStore } from '@/stores/temp'
import { useSmsStore } from '@/stores/sms'
import type { IMessageConversation } from '@/lib/interfaces'
import { useLeftSidebarResize } from '@/hooks/sidebar'
import { storeToRefs } from 'pinia'
import { openModal } from '@/components/modal'
import SendSmsModal from '@/views/messages/SendSmsModal.vue'
import ExportSmsModal from '@/views/messages/ExportSmsModal.vue'
import { decodeBase64 } from '@/lib/strutil'
import { useContactName } from '@/hooks/contacts'
import { useSelectable } from '@/hooks/list'
import type { IData } from '@/lib/interfaces'
import type { Ref } from 'vue'
import emitter from '@/plugins/eventbus'

export const sortItems = [
  { label: 'sort_by.date_desc', value: 'DATE_DESC' },
  { label: 'sort_by.date_asc', value: 'DATE_ASC' },
]

export function useMessagesSidebar() {
  const mainStore = useMainStore()
  const { app, urlTokenKey } = storeToRefs(useTempStore())
  const route = useRoute()
  const smsStore = useSmsStore()
  const { conversations, noMore } = storeToRefs(smsStore)

  const isArchived = computed(() => route.path.startsWith('/messages/archived'))
  const loading = computed(() => isArchived.value ? smsStore.archivedLoading : smsStore.normalLoading)

  const sortMenuVisible = ref(false)
  const { loadContacts, getDisplayName } = useContactName()

  const sortedConversations = computed(() => {
    if (isArchived.value) return conversations.value
    const list = [...conversations.value]
    switch (mainStore.conversationSortBy) {
      case 'DATE_ASC':
        return list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      case 'NAME_ASC':
        return list.sort((a, b) => getDisplayName(a.address).localeCompare(getDisplayName(b.address)))
      case 'NAME_DESC':
        return list.sort((a, b) => getDisplayName(b.address).localeCompare(getDisplayName(a.address)))
      default:
        return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    }
  })

  const { resizeWidth } = useLeftSidebarResize(
    300,
    () => mainStore.sidebar2Width,
    (width: number) => { mainStore.sidebar2Width = width },
  )

  const selectable = useSelectable(sortedConversations as unknown as Ref<IData[]>)

  // Initialize from store's current value (handles component remount without keep-alive)
  selectable.total.value = smsStore.conversationCount
  watch(() => smsStore.conversationCount, (count) => {
    selectable.total.value = count
  })

  function loadMore() {
    if (noMore.value || loading.value) return
    smsStore.fetchMoreConversations()
  }

  function openConversation(item: IMessageConversation) {
    if (isArchived.value) {
      replacePath(mainStore, `/messages/archived/${item.id}`)
      return
    }
    const query = route.query.q
    const path = query ? `/messages/${item.id}?q=${query}` : `/messages/${item.id}`
    replacePath(mainStore, path)
  }

  function openSendSms() { openModal(SendSmsModal, { number: '', body: '' }) }

  function openExport() {
    openModal(ExportSmsModal, { items: [], query: '', contactName: '', urlTokenKey: urlTokenKey.value })
  }

  const isActive = ref(false)

  function archiveConversations(ids: string[]) {
    smsStore.archiveConversations(ids)
    selectable.clearSelection()
  }

  function unarchiveConversations(ids: string[]) {
    smsStore.unarchiveConversations(ids)
    selectable.clearSelection()
  }

  function applyRouteQuery() {
    if (isArchived.value) {
      smsStore.fetchArchived()
    } else {
      const q = decodeBase64(route.query.q?.toString() ?? '')
      smsStore.fetchConversations(q)
    }
  }

  const smsSentHandler = () => { setTimeout(() => applyRouteQuery(), 1500) }

  watch(() => route.query.q, () => { if (isActive.value && !isArchived.value) applyRouteQuery() })

  onActivated(() => {
    isActive.value = true
    loadContacts()
    applyRouteQuery()
    emitter.on('sms_sent' as any, smsSentHandler)
  })

  onDeactivated(() => {
    isActive.value = false
    emitter.off('sms_sent' as any, smsSentHandler)
  })

  return {
    mainStore, app, route, isArchived,
    sortMenuVisible, noMore, conversations, sortedConversations, loading,
    getDisplayName, resizeWidth,
    loadMore, openConversation, openSendSms, openExport,
    archiveConversations, unarchiveConversations,
    ...selectable,
  }
}
