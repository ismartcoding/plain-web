<template>
  <left-sidebar>
    <template #title>
      {{ $t('page_title.notes') }}
    </template>
    <template #body>
      <ul class="nav">
        <li @click.prevent="all" :class="{ active: !selectedTagName && !isTrash }">
          {{ $t('all') }}
        </li>
        <li @click.prevent="trash" :class="{ active: isTrash }">
          {{ $t('trash') }}
        </li>
      </ul>
      <tag-filter type="NOTE" :selected="selectedTagName" />
    </template>
  </left-sidebar>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import router, { replacePath } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import { parseTagName } from '@/lib/search'
import { ref, watch } from 'vue'

const route = useRoute()
const mainStore = useMainStore()

const isTrash = ref(false)
const selectedTagName = ref('')

function updateActive() {
  isTrash.value = route.path === '/notes/trash'
  selectedTagName.value = isTrash.value ? '' : parseTagName(route.query)
}

updateActive()

watch(
  () => router.currentRoute.value,
  () => {
    updateActive()
  }
)

function trash() {
  replacePath(mainStore, '/notes/trash')
}

function all() {
  replacePath(mainStore, '/notes')
}
</script>
