<template>
  <div class="page-container container-fluid">
    <splitpanes>
      <pane size="20">
        <div class="sidebar">
          <h2 class="nav-title">{{ $t('page_title.files') }}</h2>
          <ul class="nav">
            <li @click.prevent="openByType('recent')" :class="{ active: route.path === '/files/recent' }">
              {{ $t('recents') }}
            </li>
            <li @click.prevent="internal" :class="{ active: route.path === '/files' }">
              {{ $t('internal_storage') }}
            </li>
            <li v-if="app.sdcardPath" @click.prevent="openByType('sdcard')" :class="{ active: type === 'sdcard' }">
              {{ $t('sdcard') }}
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
import { storeToRefs } from 'pinia'
import { useTempStore } from '@/stores/temp'

const route = useRoute()
const mainStore = useMainStore()
const { app } = storeToRefs(useTempStore())
const type = route.params['type']
function openByType(type: string) {
  replacePath(mainStore, `/files/${type}`)
}
function internal() {
  replacePath(mainStore, '/files')
}
</script>
