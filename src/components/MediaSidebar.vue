<template>
  <left-sidebar>
    <template #body>
      <ul class="nav">
        <li :class="{ active: !selectedTagId && !selectedBucketId && !trash }" @click.prevent="viewAll">
          <span class="icon" aria-hidden="true">
            <i-lucide:layout-grid />
          </span>
          <span class="title">{{ $t('all') }}</span>
          <span v-if="total >= 0" class="count">{{ total.toLocaleString() }}</span>
        </li>
        <li v-if="hasFeature(FEATURE.MEDIA_TRASH, app.osVersion)" :class="{ active: trash }" @click.prevent="viewTrash">
          <span class="icon" aria-hidden="true">
            <i-lucide:trash />
          </span>
          <span class="title">{{ $t('trash') }}</span>
          <v-icon-button v-tooltip="$t('trash_tips')" class="btn-help sm">
            <i-material-symbols:help-outline-rounded />
          </v-icon-button>
          <span v-if="totalTrash >= 0" class="count">{{ totalTrash.toLocaleString() }}</span>
        </li>
      </ul>
      <bucket-filter :type="props.type" :selected="selectedBucketId" />
      <tag-filter :type="props.type" :selected="selectedTagId" />
    </template>
  </left-sidebar>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { DataType } from '@/lib/data'
import { hasFeature } from '@/lib/feature'
import { FEATURE } from '@/lib/data'
import { useMediaSidebar } from '@/hooks/media-sidebar'

const props = defineProps({
  type: { type: String as PropType<DataType>, required: true },
  gql: { type: String, required: true },
})

const { app, total, totalTrash, trash, selectedTagId, selectedBucketId, viewAll, viewTrash } = useMediaSidebar(props.type as DataType, props.gql)
</script>
