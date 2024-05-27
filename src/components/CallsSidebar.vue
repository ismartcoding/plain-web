<template>
  <left-sidebar>
    <template #title>{{ $t('page_title.calls') }}</template>
    <template #body>
      <ul class="nav">
        <li @click.prevent="all" :class="{ active: route.path === '/calls' && !selectedTagName }">
          {{ $t('all') }}
        </li>
        <li v-for="t in types" :key="t" @click.prevent="openByType(t)" :class="{ active: t === navType }">
          {{ $t(`call_type.${t}`) }}
        </li>
      </ul>
      <tag-filter type="CALL" :selected="selectedTagName" />
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
const types = ['incoming', 'outgoing', 'missed']

const navType = ref('')
const selectedTagName = ref('')

function updateActive() {
  navType.value = route.params['type'] as string
  selectedTagName.value = navType.value ? '' : parseTagName(route.query)
}

updateActive()

watch(
  () => router.currentRoute.value,
  () => {
    updateActive()
  }
)

function openByType(type: string) {
  replacePath(mainStore, `/calls/${type}`)
}

function all() {
  replacePath(mainStore, '/calls')
}
</script>
