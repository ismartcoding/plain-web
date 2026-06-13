<template>
  <left-sidebar>
    <template #body>
      <ul class="nav">
        <SidebarListItem
          :title="$t('all')"
          :active="!selectedTagId"
          @click="viewAll"
        >
          <template #start>
            <i-lucide:layout-grid />
          </template>
          <template v-if="counter.contacts >= 0" #end>
            <span class="count">{{ counter.contacts.toLocaleString() }}</span>
          </template>
        </SidebarListItem>
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
import SidebarListItem from '@/components/SidebarListItem.vue'

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
