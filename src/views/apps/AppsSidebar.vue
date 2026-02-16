<template>
  <left-sidebar>
    <template #body>
      <ul class="nav">
        <li :class="{ active: !type }" @click.prevent="viewAll">
          <span class="icon" aria-hidden="true"><i-lucide:layout-grid /></span>
          <span class="title">{{ $t('all') }}</span>
          <span v-if="counter.packages >= 0" class="count">{{ counter.packages.toLocaleString() }}</span>
        </li>
        <li :class="{ active: 'user' === type }" @click.prevent="openByType('user')">
          <span class="icon" aria-hidden="true"><i-material-symbols:person-outline-rounded /></span>
          <span class="title">{{ $t(`app_type.user`) }}</span>
          <span v-if="userTypeCount >= 0" class="count">{{ userTypeCount.toLocaleString() }}</span>
        </li>
        <li :class="{ active: 'system' === type }" @click.prevent="openByType('system')">
          <span class="icon" aria-hidden="true"><i-material-symbols:settings-outline-rounded /></span>
          <span class="title">{{ $t(`app_type.system`) }}</span>
          <span v-if="counter.packagesSystem >= 0" class="count">{{ counter.packagesSystem.toLocaleString() }}</span>
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
