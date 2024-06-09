<template>
  <left-sidebar>
    <template #title>
      {{ $t('page_title.files') }}
    </template>
    <template #body>
      <ul class="nav">
        <li @click.prevent="openByType('recent')" :class="{ active: route.path === '/files/recent' }">
          <span class="title">{{ $t('recents') }}</span>
        </li>
        <li @click.prevent="internal" :class="{ active: route.path === '/files' && !navType }">
          <span class="title">{{ $t('internal_storage') }}</span>
        </li>
        <li v-if="app.sdcardPath" @click.prevent="openByType('sdcard')" :class="{ active: navType === 'sdcard' }">
          <span class="title">{{ $t('sdcard') }}</span>
        </li>
        <li v-for="(_, index) in app.usbDiskPaths" :key="index" @click.prevent="openByType(`usb${index + 1}`)" :class="{ active: navType === `usb${index + 1}` }">
          <span class="title">{{ $t('usb_storage') + ' ' + (index + 1) }}</span>
        </li>
        <li @click.prevent="openByType('app')" :class="{ active: navType === 'app' }">
          <span class="title">{{ $t('app_name') }}</span>
        </li>
      </ul>
    </template>
  </left-sidebar>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import router, { replacePath } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import { storeToRefs } from 'pinia'
import { useTempStore } from '@/stores/temp'
import { ref, watch } from 'vue'

const route = useRoute()
const mainStore = useMainStore()
const { app } = storeToRefs(useTempStore())

const navType = ref('')

function openByType(type: string) {
  replacePath(mainStore, `/files/${type}`)
}

function updateActive() {
  const route = router.currentRoute.value
  if (route.path === '/files/recent') {
    navType.value = 'recent'
    return
  }

  navType.value = route.params['type'] as string
}

updateActive()

watch(
  () => router.currentRoute.value.fullPath,
  () => {
    updateActive()
  }
)

function internal() {
  replacePath(mainStore, '/files')
}
</script>
