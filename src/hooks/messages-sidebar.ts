import { onActivated, onDeactivated, ref, computed, watch } from 'vue'
import toast from '@/components/toaster'
import { initLazyQuery, smsConversationsGQL } from '@/lib/api/query'
import { useRoute } from 'vue-router'
import { replacePath } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import { useTempStore } from '@/stores/temp'
import { useI18n } from 'vue-i18n'
import type { IMessageConversation } from '@/lib/interfaces'
import { useLeftSidebarResize } from '@/hooks/sidebar'
import { storeToRefs } from 'pinia'
import { openModal } from '@/components/modal'
import SendSmsModal from '@/views/messages/SendSmsModal.vue'
import ExportSmsModal from '@/views/messages/ExportSmsModal.vue'
import { decodeBase64 } from '@/lib/strutil'
import { useContactName } from '@/hooks/contacts'
import emitter from '@/plugins/eventbus'

export const sortItems = [
  { label: 'sort_by.date_desc', value: 'DATE_DESC' },
  { label: 'sort_by.date_asc', value: 'DATE_ASC' },
]

export function useMessagesSidebar() {
  const mainStore = useMainStore()
  const { app, urlTokenKey } = storeToRefs(useTempStore())
  const { t } = useI18n()
  const route = useRoute()
  const sortMenuVisible = ref(false)
  const page = ref(1)
  const limit = 50
  const total = ref(0)
  const noMore = ref(false)
  const conversations = ref<IMessageConversation[]>([])
  const { loadContacts, getDisplayName } = useContactName()

  const sortedConversations = computed(() => {
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

  const q = ref('')

  const { loading, fetch } = initLazyQuery({
    handle: (data: { smsConversations: IMessageConversation[]; smsConversationCount: number }, error: string) => {
      if (error) toast(t(error), 'error')
      else if (data) {
        if (data.smsConversations.length < limit) noMore.value = true
        conversations.value = page.value === 1 ? data.smsConversations : conversations.value.concat(data.smsConversations)
        total.value = data.smsConversationCount
      }
    },
    document: smsConversationsGQL,
    variables: () => ({ offset: (page.value - 1) * limit, limit, query: q.value }),
  })

  function loadMore() {
    if (noMore.value || loading.value) return
    page.value++
  }

  function openConversation(item: IMessageConversation) {
    const query = route.query.q
    const path = query ? `/messages/${item.id}?q=${query}` : `/messages/${item.id}`
    replacePath(mainStore, path)
  }

  function openSendSms() { openModal(SendSmsModal, { number: '', body: '' }) }

  function openExport() {
    openModal(ExportSmsModal, { items: [], query: '', contactName: '', urlTokenKey: urlTokenKey.value })
  }

  const smsSentHandler = () => { setTimeout(() => fetch(), 1500) }
  const isActive = ref(false)

  function applyRouteQuery() {
    q.value = decodeBase64(route.query.q?.toString() ?? '')
    page.value = 1
    noMore.value = false
    fetch()
  }

  watch(() => route.query.q, () => { if (isActive.value) applyRouteQuery() })

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
    mainStore, app, route, sortMenuVisible,
    total, noMore, conversations, sortedConversations, loading,
    getDisplayName, resizeWidth,
    loadMore, openConversation, openSendSms, openExport,
  }
}
