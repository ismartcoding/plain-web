<template>
  <div class="page-container container-fluid">
    <splitpanes>
      <pane size="20">
        <div class="sidebar">
          <h2 class="nav-title">{{ $t('page_title.images') }}</h2>
          <ul class="nav">
            <li
              @click.prevent="all"
              :class="{ active: route.path === '/images' && !selectedTagName && !selectedBucketId }"
            >
              {{ $t('all') }}
            </li>
          </ul>
          <bucket-filter bucket-type="IMAGE" :selected="selectedBucketId" />
          <tag-filter tag-type="IMAGE" :selected="selectedTagName" />
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

<script lang="ts">
export default {
  name: 'ImagesRoot',
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
  replacePath(mainStore, '/images')
}
</script>
