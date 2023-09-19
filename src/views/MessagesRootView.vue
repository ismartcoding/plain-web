<template>
  <div class="page-container">
    <splitpanes>
      <pane size="20" min-size="10">
        <div class="sidebar">
          <h2 class="nav-title">{{ $t('page_title.messages') }}</h2>
          <ul class="nav">
            <li @click.prevent="all" :class="{ active: route.path === '/messages' && !selectedTagName }">
              {{ $t('all') }}
            </li>
            <li v-for="t in types" :key="t" @click.prevent="openByType(t)" :class="{ active: t === type }">
              {{ $t(`message_type.${t}`) }}
            </li>
          </ul>
          <tag-filter type="SMS" :selected="selectedTagName" />
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
const type = route.params['type']
const selectedTagName = type ? '' : parseTagName(route.query)
function openByType(type: string) {
  replacePath(mainStore, `/messages/${type}`)
}
const types = ['inbox', 'sent', 'drafts']
function all() {
  replacePath(mainStore, '/messages')
}
</script>
