<template>
  <left-sidebar>
    <template #title>{{ $t('page_title.apps') }} </template>
    <template #body>
      <ul class="nav">
        <li @click.prevent="all" :class="{ active: route.path === '/apps' }">
          {{ $t('all') }}
        </li>
        <li v-for="t in types" :key="t" @click.prevent="openByType(t)" :class="{ active: t === navType }">
          {{ $t(`app_type.${t}`) }}
        </li>
      </ul>
    </template>
  </left-sidebar>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import { replacePath } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import { ref } from 'vue'

const route = useRoute()
const mainStore = useMainStore()
const types = ['user', 'system']

const navType = ref(route.params['type'] ?? '')

function openByType(type: string) {
  navType.value = type
  replacePath(mainStore, `/apps/${type}`)
}

function all() {
  navType.value = ''
  replacePath(mainStore, '/apps')
}
</script>
