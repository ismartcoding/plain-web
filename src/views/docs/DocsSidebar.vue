<template>
  <left-sidebar>
    <template #body>
      <ul class="nav">
        <li :class="{ active: !ext }" @click.prevent="viewAll">
          <span class="icon" aria-hidden="true"><i-lucide:layout-grid /></span>
          <span class="title">{{ $t('all') }}</span>
          <span v-if="totalCount >= 0" class="count">{{ totalCount.toLocaleString() }}</span>
        </li>
        <li
          v-for="group in extGroups"
          :key="group.ext"
          :class="{ active: ext === group.ext.toLowerCase() }"
          @click.prevent="viewByExt(group.ext.toLowerCase())"
        >
          <span class="icon" aria-hidden="true"><i-lucide:file-text /></span>
          <span class="title">{{ group.ext }}</span>
          <span class="count">{{ group.count.toLocaleString() }}</span>
        </li>
      </ul>
    </template>
  </left-sidebar>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import router, { replacePath } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import { decodeBase64, encodeBase64 } from '@/lib/strutil'
import { buildQuery, parseQuery } from '@/lib/search'
import { initLazyQuery, docCountGQL } from '@/lib/api/query'
import type { IDocExtGroup } from '@/lib/interfaces'

const mainStore = useMainStore()
const totalCount = ref(-1)
const extGroups = ref<IDocExtGroup[]>([])
const ext = ref('')

const { fetch } = initLazyQuery({
  handle: (data: { total: number; extGroups: IDocExtGroup[] }) => {
    if (data) {
      totalCount.value = data.total
      extGroups.value = data.extGroups
    }
  },
  document: docCountGQL,
  variables: () => ({}),
})

function updateActive() {
  const route = router.currentRoute.value
  const q = decodeBase64(route.query.q?.toString() ?? '')
  const parts = q.split(' ')
  const extPart = parts.find((p) => p.startsWith('ext:'))
  ext.value = extPart ? extPart.replace('ext:', '') : ''
  fetch()
}

function viewAll() {
  replacePath(mainStore, '/docs')
}

function viewByExt(value: string) {
  const currentQ = decodeBase64(router.currentRoute.value.query.q?.toString() ?? '')
  const fields = currentQ ? parseQuery(currentQ).filter((f) => f.name !== 'ext') : []
  fields.push({ name: 'ext', op: '', value })
  replacePath(mainStore, `/docs?q=${encodeBase64(buildQuery(fields))}`)
}

updateActive()

watch(
  () => router.currentRoute.value,
  () => {
    updateActive()
  }
)
</script>
