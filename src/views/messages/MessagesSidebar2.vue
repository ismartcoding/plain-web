<template>
  <aside class="sidebar2" :class="{ 'sidebar2-full': !route.params.threadId }" :style="{ width: route.params.threadId ? mainStore.sidebar2Width + 'px' : undefined }">
    <div class="top-app-bar">
      <div class="title">
        <span>{{ $t('page_title.conversations') }} ({{ total.toLocaleString() }})</span>
      </div>
      <div class="actions">
        <v-dropdown v-model="sortMenuVisible">
          <template #trigger>
            <v-icon-button v-tooltip="$t('sort')">
              <i-material-symbols:sort-rounded />
            </v-icon-button>
          </template>
          <div
            v-for="item in sortItems"
            :key="item.value"
            class="dropdown-item"
            :class="{ selected: item.value === mainStore.conversationSortBy }"
            @click="mainStore.conversationSortBy = item.value; sortMenuVisible = false"
          >
            {{ $t(item.label) }}
          </div>
        </v-dropdown>
        <v-icon-button v-tooltip="$t('send_sms')" @click.stop="openSendSms()">
          <i-material-symbols:sms-outline-rounded />
        </v-icon-button>
      </div>
    </div>
    <div v-if="loading && conversations.length === 0" class="scroller">
      <section v-for="i in 20" :key="i" class="conversation-item selectable-card-skeleton">
        <div class="title">
          <div class="skeleton-text text lg" style="width: 50%"></div>
        </div>
        <div class="subtitle">
          <div class="skeleton-text" style="width: 60%"></div>
        </div>
      </section>
    </div>
    <VirtualList v-if="conversations.length > 0" class="scroller" :data-key="'id'" :data-sources="sortedConversations" :estimate-size="80" @tobottom="loadMore">
      <template #item="{ index, item }">
        <a
          class="item-link"
          :href="`/messages/${item.id}`"
          @click.prevent="openConversation(item)"
        >
          <article
            class="conversation-item selectable-card"
            :class="{ selected: item.id == route.params.threadId }"
          >
            <div class="title">
              <span class="number"><field-id :id="index + 1" :raw="item" /></span>
              <div class="text">{{ getDisplayName(item.address) }}<span class="count">({{ item.messageCount.toLocaleString() }})</span></div>
              <span v-tooltip="formatDateTime(item.date)" class="time">{{ formatTimeAgo(item.date) }}</span>
            </div>
            <div class="subtitle">
              {{ item.snippet || '-' }}
            </div>
          </article>
        </a>
      </template>
      <template #footer>
        <v-circular-progress v-if="!noMore" indeterminate class="sm" />
      </template>
    </VirtualList>

    <div v-if="!loading && conversations.length === 0" class="no-data-placeholder">
      {{ $t(noDataKey(loading, app.permissions, 'READ_SMS')) }}
    </div>
    <div class="sidebar-drag-indicator" @mousedown="resizeWidth"></div>
  </aside>
</template>

<script setup lang="ts">
import { onActivated, onDeactivated, ref, computed, watch } from 'vue'
import toast from '@/components/toaster'
import { formatTimeAgo, formatDateTime } from '@/lib/format'
import { initLazyQuery, smsConversationsGQL } from '@/lib/api/query'
import { useRoute } from 'vue-router'
import { replacePath } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import { useTempStore } from '@/stores/temp'
import { useI18n } from 'vue-i18n'
import type { IMessageConversation } from '@/lib/interfaces'
import { noDataKey } from '@/lib/list'
import { useLeftSidebarResize } from '@/hooks/sidebar'
import { storeToRefs } from 'pinia'
import { openModal } from '@/components/modal'
import SendSmsModal from '@/components/messages/SendSmsModal.vue'
import { decodeBase64 } from '@/lib/strutil'
import { useContactName } from '@/hooks/contacts'
import emitter from '@/plugins/eventbus'
import VirtualList from '@/components/virtualscroll'

const mainStore = useMainStore()
const { app } = storeToRefs(useTempStore())
const sortMenuVisible = ref(false)
const sortItems = [
  { label: 'sort_by.date_desc', value: 'DATE_DESC' },
  { label: 'sort_by.date_asc', value: 'DATE_ASC' },
]
const { t } = useI18n()
const route = useRoute()
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
    default: // DATE_DESC
      return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }
})

const { resizeWidth } = useLeftSidebarResize(
  300,
  () => mainStore.sidebar2Width,
  (width: number) => {
    mainStore.sidebar2Width = width
  },
)

const q = ref('')

const { loading, fetch } = initLazyQuery({
  handle: (data: { smsConversations: IMessageConversation[]; smsConversationCount: number }, error: string) => {
    if (error) {
      toast(t(error), 'error')
    } else if (data) {
      if (data.smsConversations.length < limit) {
        noMore.value = true
      }
      if (page.value === 1) {
        conversations.value = data.smsConversations
      } else {
        conversations.value = conversations.value.concat(data.smsConversations)
      }
      total.value = data.smsConversationCount
    }
  },
  document: smsConversationsGQL,
  variables: () => ({
    offset: (page.value - 1) * limit,
    limit,
    query: q.value,
  }),
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

function openSendSms() {
  openModal(SendSmsModal, {
    number: '',
    body: '',
  })
}

const smsSentHandler = () => {
  fetch()
}

const isActive = ref(false)

function applyRouteQuery() {
  q.value = decodeBase64(route.query.q?.toString() ?? '')
  page.value = 1
  noMore.value = false
  fetch()
}

watch(
  () => route.query.q,
  () => {
    if (!isActive.value) return
    applyRouteQuery()
  },
)

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
</script>

<style scoped lang="scss">
.sidebar2 {
  position: relative;
  display: flex;
  flex-direction: column;
  height: calc(100vh - var(--pl-top-app-bar-height));

  &.sidebar2-full {
    flex: 1;
  }
}

.scroller {
  overflow-y: auto;
  overflow-x: hidden;
  flex: 1;

  .item-link {
    text-decoration: none;
    display: block;
  }
}

.conversation-item {
  margin: 0 16px 8px 16px;
  display: grid;
  box-sizing: border-box;
  border-radius: 8px;
  grid-template-areas:
    'title'
    'subtitle';
  grid-template-columns: 1fr;

  &:hover {
    cursor: pointer;
  }

  .title {
    grid-area: title;
    display: flex;
    align-items: center;

    .number {
      min-width: 40px;
      text-align: center;
      flex-shrink: 0;
    }

    .text {
      font-weight: 500;
      flex: 1;
      width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      margin-block: 8px;
      margin-inline-end: 8px;

      .count {
        font-weight: 400;
        color: var(--md-sys-color-on-surface-variant);
        margin-inline-start: 4px;
        font-size: 0.875rem;
      }
    }

    .time {
      flex-shrink: 0;
      font-size: 0.75rem;
      color: var(--md-sys-color-on-surface-variant);
      margin-inline-end: 12px;
    }
  }

  .subtitle {
    font-size: 0.875rem;
    grid-area: subtitle;
    align-items: end;
    margin-block-end: 12px;
    margin-inline-end: 16px;
    margin-inline-start: 40px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--md-sys-color-on-surface-variant);
  }
}
</style>
