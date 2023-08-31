<template>
  <div class="page-container">
    <splitpanes>
      <pane size="20" min-size="10">
        <div class="sidebar">
          <h2 class="nav-title">{{ $t('page_title.apps') }}</h2>
          <ul class="nav">
            <li @click.prevent="all" :class="{ active: route.path === '/apps' }">
              {{ $t('all') }}
            </li>
            <li v-for="t in types" :key="t" @click.prevent="openByType(t)" :class="{ active: t === type }">
              {{ $t(`app_type.${t}`) }}
            </li>
          </ul>
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

const route = useRoute()
const mainStore = useMainStore()
const type = route.params['type']
function openByType(type: string) {
  replacePath(mainStore, `/apps/${type}`)
}
const types = ['user', 'system']
function all() {
  replacePath(mainStore, '/apps')
}
</script>
