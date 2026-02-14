<template>
  <left-sidebar>
    <template #body>
      <ul class="nav">
        <li :class="{ active: !selectedTagId && !type }" @click.prevent="viewAll">
          <span class="title">{{ $t('all') }}</span>
          <span v-if="counter.calls >= 0" class="count">{{ counter.calls.toLocaleString() }}</span>
        </li>
        <li v-for="t in ['1', '2', '3']" :key="t" :class="{ active: t === type }" @click.prevent="openByType(t)">
          <span class="title">{{ $t(`call_type.${t}`) }}</span>
          <span v-if="getTypeCount(t) >= 0" class="count">{{ getTypeCount(t).toLocaleString() }}</span>
        </li>
      </ul>
      <tag-filter type="CALL" :selected="selectedTagId" />
    </template>
  </left-sidebar>
</template>

<script setup lang="ts">
import router, { replacePath } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import { onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useSearch } from '@/hooks/search'
import type { IFilter } from '@/lib/interfaces'
import { decodeBase64, encodeBase64 } from '@/lib/strutil'
import { buildQuery } from '@/lib/search'
import { useTempStore } from '@/stores/temp'
import { storeToRefs } from 'pinia'
import { callCountGQL, initLazyQuery } from '@/lib/api/query'
import emitter from '@/plugins/eventbus'

const mainStore = useMainStore()
const { counter } = storeToRefs(useTempStore())
const { parseQ } = useSearch()
const filter = reactive<IFilter>({
  tagIds: [],
})

const type = ref('')
const selectedTagId = ref('')
const typesCount = ref<Map<string, number>>(new Map())

const { fetch } = initLazyQuery({
  handle: (data: { total: number; incoming: number; outgoing: number; missed: number }) => {
    if (data) {
      counter.value.calls = data.total
      typesCount.value.set('1', data.incoming)
      typesCount.value.set('2', data.outgoing)
      typesCount.value.set('3', data.missed)
    }
  },
  document: callCountGQL,
  variables: () => ({}),
})

function getTypeCount(id: string) {
  return typesCount.value.get(id) ?? -1
}

function updateActive() {
  const route = router.currentRoute.value
  const q = decodeBase64(route.query.q?.toString() ?? '')
  parseQ(filter, q)
  type.value = filter.type ?? ''
  selectedTagId.value = filter.tagIds.length === 1 ? filter.tagIds[0] : ''
  if (type.value) {
    selectedTagId.value = ''
  }
  fetch()
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
  replacePath(mainStore, `/calls?q=${encodeBase64(q)}`)
}

function viewAll() {
  replacePath(mainStore, '/calls')
}

const callsDeletedHandler = () => {
  fetch()
}

onMounted(() => {
  emitter.on('calls_deleted', callsDeletedHandler)
})

onUnmounted(() => {
  emitter.off('calls_deleted', callsDeletedHandler)
})
</script>
