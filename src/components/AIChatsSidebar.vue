<template>
  <left-sidebar>
    <template #title>
      {{ $t('page_title.aichats') }}
    </template>
    <template #actions>
      <button class="icon-button" @click.prevent="config" v-tooltip="$t('config')">
        <md-ripple />
        <i-material-symbols:settings-outline />
      </button>
    </template>
    <template #body>
      <ul class="nav">
        <li @click.prevent="all" :class="{ active: !selectedTagName }">
          {{ $t('all') }}
        </li>
      </ul>
      <tag-filter type="AI_CHAT" :selected="selectedTagName" />
    </template>
  </left-sidebar>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import router, { replacePath } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import { parseTagName } from '@/lib/search'
import { openModal } from '@/components/modal'
import AIChatConfigModal from '@/components/AIChatConfigModal.vue'
import { ref, watch } from 'vue'

const route = useRoute()
const mainStore = useMainStore()

const selectedTagName = ref('')

function updateActive() {
  selectedTagName.value = parseTagName(route.query)
}

updateActive()

watch(
  () => router.currentRoute.value,
  () => {
    updateActive()
  }
)

function all() {
  replacePath(mainStore, '/aichats')
}

function config() {
  openModal(AIChatConfigModal)
}
</script>
