<template>
  <left-sidebar>
    <template #body>
      <ul class="nav">
        <SidebarListItem
          :title="$t('all')"
          :active="!type"
          @click="viewAll"
        >
          <template #start>
            <i-lucide:layout-grid />
          </template>
          <template v-if="counter.packages >= 0" #end>
            <span class="count">{{ counter.packages.toLocaleString() }}</span>
          </template>
        </SidebarListItem>
        <SidebarListItem
          :title="$t('app_type.USER')"
          :active="'USER' === type"
          @click="openByType('USER')"
        >
          <template #start>
            <i-material-symbols:person-outline-rounded />
          </template>
          <template v-if="userTypeCount >= 0" #end>
            <span class="count">{{ userTypeCount.toLocaleString() }}</span>
          </template>
        </SidebarListItem>
        <SidebarListItem
          :title="$t('app_type.SYSTEM')"
          :active="'SYSTEM' === type"
          @click="openByType('SYSTEM')"
        >
          <template #start>
            <i-material-symbols:settings-outline-rounded />
          </template>
          <template v-if="counter.packagesSystem >= 0" #end>
            <span class="count">{{ counter.packagesSystem.toLocaleString() }}</span>
          </template>
        </SidebarListItem>
      </ul>
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
import { initLazyQuery, packageCountGQL } from '@/lib/api/query'
import { storeToRefs } from 'pinia'
import { useTempStore } from '@/stores/temp'

const mainStore = useMainStore()
const { counter } = storeToRefs(useTempStore())
const { parseQ } = useSearch()
const filter = reactive<IFilter>({
  tagIds: [],
})
const type = ref('')
const userTypeCount = ref(-1)

const { fetch } = initLazyQuery({
  handle: (data: { total: number; system: number }) => {
    if (data) {
      counter.value.packages = data.total
      counter.value.packagesSystem = data.system
      userTypeCount.value = data.total - data.system
    }
  },
  document: packageCountGQL,
  variables: () => ({}),
})

function updateActive() {
  const route = router.currentRoute.value
  const q = decodeBase64(route.query.q?.toString() ?? '')
  parseQ(filter, q)
  type.value = filter.type ?? ''
  fetch()
}

function openByType(type: string) {
  const q = buildQuery([
    {
      name: 'type',
      op: '',
      value: type,
    },
  ])
  replacePath(mainStore, `/apps?q=${encodeBase64(q)}`)
}

function viewAll() {
  replacePath(mainStore, '/apps')
}

updateActive()

watch(
  () => router.currentRoute.value,
  () => {
    updateActive()
  }
)
</script>
