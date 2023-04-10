<template>
  <div class="page-container container-fluid">
    <splitpanes>
      <pane size="20">
        <div class="sidebar">
          <h2 class="nav-title">{{ $t('page_title.calls') }}</h2>
          <ul class="nav">
            <li @click.prevent="all" :class="{ active: route.path === '/calls' && !selectedTagName }">
              {{ $t('all') }}
            </li>
            <li v-for="t in types" :key="t" @click.prevent="openByType(t)" :class="{ active: t === type }">
              {{ $t(`call_type.${t}`) }}
            </li>
          </ul>
          <tag-filter tag-type="CALL" :selected="selectedTagName" />
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
  replacePath(mainStore, `/calls/${type}`)
}
const types = [
  'incoming', 'outgoing', 'missed'
]
function all() {
  replacePath(mainStore, '/calls')
}
</script>
