<template>
  <left-sidebar>
    <template #title>
      {{ $t('page_title.aichats') }}
    </template>
    <template #actions>
      <button class="btn-icon" @click.prevent="config" v-tooltip="$t('config')">
        <md-ripple />
        <i-material-symbols:settings-outline />
      </button>
    </template>
    <template #body>
      <ul class="nav">
        <li @click.prevent="viewAll" :class="{ active: !selectedTagId }">
          <span class="title">{{ $t('all') }}</span>
        </li>
      </ul>
      <tag-filter type="AI_CHAT" :selected="selectedTagId" />
    </template>
  </left-sidebar>
</template>

<script setup lang="ts">
import router, { replacePath } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import { useSearch } from '@/hooks/search'
import { openModal } from '@/components/modal'
import AIChatConfigModal from '@/components/AIChatConfigModal.vue'
import { reactive, ref, watch } from 'vue'
import { decodeBase64 } from '@/lib/strutil'
import type { IFilter } from '@/lib/interfaces'

const mainStore = useMainStore()
const { parseQ } = useSearch()
const filter = reactive<IFilter>({
  tagIds: [],
})
const selectedTagId = ref('')

function updateActive() {
  const route = router.currentRoute.value
  const q = decodeBase64(route.query.q?.toString() ?? '')
  parseQ(filter, q)
  selectedTagId.value = filter.tagIds.length === 1 ? filter.tagIds[0] : ''
}

updateActive()

watch(
  () => router.currentRoute.value,
  () => {
    updateActive()
  }
)

function viewAll() {
  replacePath(mainStore, '/aichats')
}

function config() {
  openModal(AIChatConfigModal)
}
</script>
