<template>
  <div class="page-container">
    <splitpanes>
      <pane size="20" min-size="10">
        <div class="sidebar">
          <h2 class="nav-title">{{ $t('page_title.notes') }}</h2>
          <ul class="nav">
            <li @click.prevent="all" :class="{ active: route.path === '/notes' && !selectedTagName }">
              {{ $t('all') }}
            </li>
            <li @click.prevent="trash" :class="{ active: route.path === '/notes/trash' }">
              {{ $t('trash') }}
            </li>
          </ul>
          <tag-filter type="NOTE" :selected="selectedTagName" />
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
function trash() {
  replacePath(mainStore, '/notes/trash')
}

function all() {
  replacePath(mainStore, '/notes')
}
</script>
