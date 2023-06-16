<template>
  <div class="page-container container-fluid">
    <splitpanes>
      <pane size="20">
        <div class="sidebar">
          <h2 class="nav-title">
            {{ $t('page_title.aichats') }}
            <button class="btn btn-sm" type="button" @click.prevent="config">
              <i-material-symbols:settings-outline />
            </button>
          </h2>
          <ul class="nav">
            <li @click.prevent="all" :class="{ active: route.path === '/aichats' && !selectedTagName }">
              {{ $t('all') }}
            </li>
          </ul>
          <tag-filter tag-type="AI_CHAT" :selected="selectedTagName" />
        </div>
      </pane>
      <pane>
        <div class="main">
          <router-view />
        </div>
      </pane>
    </splitpanes>
  </div>
</template>

<script setup lang="ts">
import { Splitpanes, Pane } from 'splitpanes'
import { useRoute } from 'vue-router'
import { replacePath } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import { parseTagName } from '@/lib/search'
import { openModal } from '@/components/modal'
import AIChatConfigModal from '@/components/AIChatConfigModal.vue'

const route = useRoute()
const mainStore = useMainStore()
const selectedTagName = parseTagName(route.query)

function all() {
  replacePath(mainStore, '/aichats')
}

function config() {
  openModal(AIChatConfigModal)
}
</script>
