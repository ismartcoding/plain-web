<template>
  <div class="page-container">
    <splitpanes>
      <pane size="20" min-size="10">
        <div class="sidebar">
          <h2 class="nav-title">{{ $t('page_title.contacts') }}</h2>
          <ul class="nav">
            <li @click.prevent="all" :class="{ active: route.path === '/contacts' && !selectedTagName }">
              {{ $t('all') }}
            </li>
          </ul>
          <tag-filter type="CONTACT" :selected="selectedTagName" />
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

const route = useRoute()
const mainStore = useMainStore()
const selectedTagName = parseTagName(route.query)
function all() {
  replacePath(mainStore, '/contacts')
}
</script>
