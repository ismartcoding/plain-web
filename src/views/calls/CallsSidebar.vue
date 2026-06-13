<template>
  <left-sidebar>
    <template #body>
      <ul class="nav">
        <SidebarListItem
          :title="$t('all')"
          :active="allActive()"
          @click="viewAll"
        >
          <template #start>
            <i-lucide:layout-grid />
          </template>
          <template v-if="counter.calls >= 0" #end>
            <span class="count">{{ counter.calls.toLocaleString() }}</span>
          </template>
        </SidebarListItem>
        <SidebarListItem
          v-for="t in types"
          :key="t.id"
          :title="$t(`call_type.${t.id}`)"
          :active="isTypeActive(t.id)"
          @click="openType(t.id)"
        >
          <template #start>
            <i-material-symbols:call-received v-if="t.id === '1'" />
            <i-material-symbols:call-made v-else-if="t.id === '2'" />
            <i-material-symbols:call-missed v-else />
          </template>
          <template v-if="getTypeCount(t.id) >= 0" #end>
            <span class="count">{{ getTypeCount(t.id).toLocaleString() }}</span>
          </template>
        </SidebarListItem>
      </ul>
      <tag-filter type="CALL" :selected="selectedTagId" />
    </template>
  </left-sidebar>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import router from '@/plugins/router'
import { storeToRefs } from 'pinia'
import { useTempStore } from '@/stores/temp'
import { callCountGQL, initLazyQuery } from '@/lib/api/query'
import { useNavSection } from '@/hooks/nav-section'
import emitter from '@/plugins/eventbus'

const types = [{ id: '1' }, { id: '2' }, { id: '3' }]

const { counter } = storeToRefs(useTempStore())
const typesCount = ref<Map<string, number>>(new Map())

const { allActive, isTypeActive, selectedTagId, viewAll, openType } = useNavSection({
  basePath: '/calls',
  types,
})

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

watch(
  () => router.currentRoute.value,
  () => {
    fetch()
  },
)

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
