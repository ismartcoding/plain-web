<template>
  <left-sidebar>
    <template #body>
      <ul class="nav">
        <li :class="{ active: !selectedTagId }" @click.prevent="viewAll">
          <span class="title">{{ $t('all') }}</span>
          <span v-if="counter.contacts >= 0" class="count">{{ counter.contacts.toLocaleString() }}</span>
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
  handle: (data: { total: number }) => {
    if (data) {
      counter.value.contacts = data.total
    }
  },
  document: contactCountGQL,
  variables: () => ({}),
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
