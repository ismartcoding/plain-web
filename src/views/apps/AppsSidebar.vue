<template>
  <left-sidebar>
    <template #title>{{ $t('page_title.apps') }}</template>
    <template #body>
      <ul class="nav">
        <li @click.prevent="viewAll" :class="{ active: !type }">
          {{ $t('all') }}<span class="count" v-if="counter.packages >= 0">{{ counter.packages.toLocaleString() }}</span>
        </li>
        <li @click.prevent="openByType('user')" :class="{ active: 'user' === type }">
          {{ $t(`app_type.user`) }}<span class="count" v-if="userTypeCount >= 0">{{ userTypeCount.toLocaleString() }}</span>
        </li>
        <li @click.prevent="openByType('system')" :class="{ active: 'system' === type }">
          {{ $t(`app_type.system`) }}<span class="count" v-if="counter.packagesSystem >= 0">{{ counter.packagesSystem.toLocaleString() }}</span>
        </li>
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
  handle: (data: any) => {
    if (data) {
      counter.value.packages = data.total
      counter.value.packagesSystem = data.system
      userTypeCount.value = data.total - data.system
    }
  },
  document: packageCountGQL,
  variables: () => ({}),
  appApi: true,
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
