<template>
  <left-sidebar>
    <template #body>
      <ul class="nav">
        <li :class="{ active: !selectedTagId && !type && !isArchived }" @click.prevent="viewAll">
          <span class="icon" aria-hidden="true"><i-lucide:layout-grid /></span>
          <span class="title">{{ $t('all') }}</span>
          <span v-if="counter.messages >= 0" class="count">{{ counter.messages.toLocaleString() }}</span>
        </li>
        <li v-for="t in ['1', '2', '3']" :key="t" :class="{ active: t === type }" @click.prevent="openByType(t)">
          <span class="icon" aria-hidden="true">
            <i-material-symbols:inbox-outline-rounded v-if="t === '1'" />
            <i-material-symbols:send-outline-rounded v-else-if="t === '2'" />
            <i-material-symbols:draft-outline-rounded v-else />
          </span>
          <span class="title">{{ $t(`message_type.${t}`) }}</span>
          <span v-if="getTypeCount(t) >= 0" class="count">{{ getTypeCount(t).toLocaleString() }}</span>
        </li>
        <li :class="{ active: isArchived }" @click.prevent="viewArchived">
          <span class="icon" aria-hidden="true"><i-material-symbols:archive-outline-rounded /></span>
          <span class="title">{{ $t('archived') }}</span>
        </li>
      </ul>
      <tag-filter type="SMS" :selected="selectedTagId" />
    </template>
  </left-sidebar>
</template>

<script setup lang="ts">
import router, { replacePath } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import { reactive, ref, watch } from 'vue'
import { useSearch } from '@/hooks/search'
import type { IFilter } from '@/lib/interfaces'
import { decodeBase64, encodeBase64 } from '@/lib/strutil'
import { buildQuery } from '@/lib/search'
import { useTempStore } from '@/stores/temp'
import { useSmsStore } from '@/stores/sms'
import { storeToRefs } from 'pinia'

const mainStore = useMainStore()
const { counter } = storeToRefs(useTempStore())
const smsStore = useSmsStore()
const { typesCount } = storeToRefs(smsStore)
const { parseQ } = useSearch()
const filter = reactive<IFilter>({
  tagIds: [],
})
const type = ref('')
const isArchived = ref(false)
const selectedTagId = ref('')

function getTypeCount(id: string) {
  return typesCount.value.get(id) ?? -1
}

function updateActive() {
  const route = router.currentRoute.value
  const q = decodeBase64(route.query.q?.toString() ?? '')
  parseQ(filter, q)
  type.value = filter.type ?? ''
  selectedTagId.value = filter.tagIds.length === 1 ? filter.tagIds[0] : ''
  isArchived.value = router.currentRoute.value.path.startsWith('/messages/archived')
  if (type.value) {
    selectedTagId.value = ''
  }
  smsStore.fetchCounts()
}

updateActive()

watch(
  () => router.currentRoute.value,
  () => {
    updateActive()
  }
)

function openByType(type: string) {
  const q = buildQuery([
    {
      name: 'type',
      op: '',
      value: type,
    },
  ])
  replacePath(mainStore, `/messages?q=${encodeBase64(q)}`)
}

function viewAll() {
  replacePath(mainStore, '/messages')
}

function viewArchived() {
  replacePath(mainStore, '/messages/archived')
}
</script>
