<template>
  <left-sidebar>
    <template #title>
      {{ $t('page_title.contacts') }}
    </template>
    <template #body>
      <ul class="nav">
        <li @click.prevent="viewAll" :class="{ active: !selectedTagId }">
          {{ $t('all') }}<span class="count" v-if="counter.contacts >= 0">{{ counter.contacts.toLocaleString() }}</span>
        </li>
      </ul>
      <tag-filter type="CONTACT" :selected="selectedTagId" />
    </template>
  </left-sidebar>
</template>

<script setup lang="ts">
import router, { replacePath } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import { reactive, ref, watch } from 'vue'
import { useSearch } from '@/hooks/search'
import type { IFilter } from '@/lib/interfaces'
import { decodeBase64 } from '@/lib/strutil'
import { storeToRefs } from 'pinia'
import { useTempStore } from '@/stores/temp'
import { contactCountGQL, initLazyQuery } from '@/lib/api/query'

const mainStore = useMainStore()
const { counter } = storeToRefs(useTempStore())
const { parseQ } = useSearch()
const filter = reactive<IFilter>({
  tagIds: [],
})

const selectedTagId = ref('')

const { fetch } = initLazyQuery({
  handle: (data: any) => {
    if (data) {
      counter.value.contacts = data.total
    }
  },
  document: contactCountGQL,
  variables: () => ({}),
  appApi: true,
})

function updateActive() {
  const route = router.currentRoute.value
  const q = decodeBase64(route.query.q?.toString() ?? '')
  parseQ(filter, q)
  selectedTagId.value = filter.tagIds.length === 1 ? filter.tagIds[0] : ''
  fetch()
}

updateActive()

watch(
  () => router.currentRoute.value,
  () => {
    updateActive()
  }
)

function viewAll() {
  replacePath(mainStore, '/contacts')
}
</script>
