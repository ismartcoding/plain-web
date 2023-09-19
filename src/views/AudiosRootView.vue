<template>
  <div class="page-container">
    <splitpanes>
      <pane size="20" min-size="10">
        <aside class="sidebar">
          <h2 class="nav-title">{{ $t('page_title.audios') }}</h2>
          <ul class="nav">
            <li
              @click.prevent="all"
              :class="{ active: route.path === '/audios' && !selectedTagName && !selectedBucketId }"
            >
              {{ $t('all') }}
            </li>
            <bucket-filter type="AUDIO" :selected="selectedBucketId" />
          </ul>
          <tag-filter type="AUDIO" :selected="selectedTagName" />
        </aside>
      </pane>
      <pane>
        <main class="main">
          <router-view />
        </main>
      </pane>
    </splitpanes>
  </div>
</template>

<script lang="ts">
export default {
  name: 'AudiosRoot',
  inheritAttrs: false,
  customOptions: {},
}
</script>

<script setup lang="ts">
import { Splitpanes, Pane } from 'splitpanes'
import { useRoute } from 'vue-router'
import { replacePath } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import { parseLocationQuery } from '@/lib/search'

const route = useRoute()
const mainStore = useMainStore()
const fields = parseLocationQuery(route.query)
const selectedTagName = fields.find((it) => it.name === 'tag')?.value ?? ''
const selectedBucketId = fields.find((it) => it.name === 'bucket_id')?.value ?? ''
function all() {
  replacePath(mainStore, '/audios')
}
</script>
