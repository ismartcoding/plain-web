<template>
  <left-sidebar>
    <template #title>
      {{ $t('page_title.contacts') }}
    </template>
    <template #body>
      <ul class="nav">
        <li @click.prevent="all" :class="{ active: !selectedTagName }">
          {{ $t('all') }}
        </li>
      </ul>
      <tag-filter type="CONTACT" :selected="selectedTagName" />
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

const selectedTagName = ref('')

function updateActive() {
  selectedTagName.value = parseTagName(route.query)
}

updateActive()

watch(
  () => router.currentRoute.value,
  () => {
    updateActive()
  }
)

function all() {
  replacePath(mainStore, '/contacts')
}
</script>
