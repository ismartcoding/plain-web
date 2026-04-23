<template>
  <div v-if="extGroups.length > 0">
    <div class="section-title">
      {{ $t('file_types') }}
      <v-icon-button v-tooltip="isCollapsed ? $t('expand_all') : $t('collapse_all')" @click.prevent="toggleCollapsed">
        <i-material-symbols:expand-more-rounded v-if="isCollapsed" />
        <i-material-symbols:expand-less-rounded v-else />
      </v-icon-button>
    </div>
    <ul v-show="!isCollapsed" class="nav">
      <li
        v-for="group in sortedGroups"
        :key="group.ext"
        :class="{ active: selected === group.ext.toLowerCase() }"
        @click.prevent="viewByExt(group.ext.toLowerCase())"
      >
        <span class="title">{{ group.ext.toUpperCase() }}</span>
        <span class="count">{{ group.count.toLocaleString() }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useMainStore } from '@/stores/main'
import type { IDocExtGroup } from '@/lib/interfaces'

const props = defineProps<{
  extGroups: IDocExtGroup[]
  selected: string
  viewByExt: (ext: string) => void
}>()

const mainStore = useMainStore()
const isCollapsed = computed(() => !!mainStore.bucketFilterCollapsed?.['doc_ext'])

function toggleCollapsed() {
  mainStore.bucketFilterCollapsed['doc_ext'] = !isCollapsed.value
}

const sortedGroups = computed(() =>
  [...props.extGroups].sort((a, b) => a.ext.localeCompare(b.ext, undefined, { sensitivity: 'base' }))
)
</script>
