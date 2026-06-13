<template>
  <left-sidebar>
    <template #body>
      <ul class="nav">
        <SidebarListItem
          :title="$t('all')"
          :active="!selectedTagId && !trash"
          @click="viewAll"
        >
          <template #start>
            <i-lucide:layout-grid />
          </template>
          <template v-if="counter.notes >= 0" #end>
            <span class="count">{{ counter.notes.toLocaleString() }}</span>
          </template>
        </SidebarListItem>
        <SidebarListItem
          :title="$t('trash')"
          :active="trash"
          @click="viewTrash"
        >
          <template #start>
            <i-lucide:trash />
          </template>
          <template v-if="counter.notesTrash >= 0" #end>
            <span class="count">{{ counter.notesTrash.toLocaleString() }}</span>
          </template>
        </SidebarListItem>
      </ul>
      <tag-filter type="NOTE" :selected="selectedTagId" />
    </template>
  </left-sidebar>
</template>

<script setup lang="ts">
import router, { replacePath } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import { useSearch } from '@/hooks/search'
import { onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { decodeBase64, encodeBase64 } from '@/lib/strutil'
import type { IFilter } from '@/lib/interfaces'
import { buildQuery } from '@/lib/search'
import { useTempStore } from '@/stores/temp'
import { storeToRefs } from 'pinia'
import { initLazyQuery, noteCountGQL } from '@/lib/api/query'
import emitter from '@/plugins/eventbus'
import SidebarListItem from '@/components/SidebarListItem.vue'

const mainStore = useMainStore()
const { counter } = storeToRefs(useTempStore())
const { parseQ } = useSearch()
const filter = reactive<IFilter>({
  tagIds: [],
})

const trash = ref(false)
const selectedTagId = ref('')

const { fetch } = initLazyQuery({
  handle: (data: { total: number; trash: number }) => {
    if (data) {
      counter.value.notes = data.total
      counter.value.notesTrash = data.trash
    }
  },
  document: noteCountGQL,
  variables: () => ({}),
})

function updateActive() {
  const route = router.currentRoute.value
  const q = decodeBase64(route.query.q?.toString() ?? '')
  parseQ(filter, q)
  selectedTagId.value = filter.tagIds.length === 1 ? filter.tagIds[0] : ''
  trash.value = filter.trash ?? false
  if (trash.value) {
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

function viewTrash() {
  const q = buildQuery([
    {
      name: 'trash',
      op: '',
      value: 'true',
    },
  ])
  replacePath(mainStore, `/notes?q=${encodeBase64(q)}`)
}

function viewAll() {
  replacePath(mainStore, '/notes')
}

const notesActionedHandler = () => {
  fetch()
}

onMounted(() => {
  emitter.on('notes_actioned', notesActionedHandler)
})

onUnmounted(() => {
  emitter.off('notes_actioned', notesActionedHandler)
})
</script>
