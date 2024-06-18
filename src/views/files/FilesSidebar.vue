<template>
  <left-sidebar>
    <template #title>
      {{ $t('page_title.files') }}
    </template>
    <template #body>
      <ul class="nav">
        <li @click.prevent="openRecent" :class="{ active: route.path === '/files/recent' }">
          <span class="title">{{ $t('recents') }}</span>
        </li>
        <li v-for="item in links" @click.prevent="openLink(item)" :class="{ active: route.path === '/files' && item.name === filter.linkName }">
          <span class="title">{{ $t(item.label) }}</span>
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
import { computed, reactive, ref, watch } from 'vue'
import { buildQuery } from '@/lib/search'
import type { IFileFilter } from '@/lib/interfaces'
import { useSearch } from '@/hooks/files'
import { decodeBase64, encodeBase64 } from '@/lib/strutil'

const route = useRoute()
const mainStore = useMainStore()
const { app } = storeToRefs(useTempStore())

const { parseQ } = useSearch()
const filter = reactive<IFileFilter>({
  linkName: '',
  text: '',
  parent: '',
})

const parent = ref('')
const recent = ref(false)

function openRecent() {
  replacePath(mainStore, '/files/recent')
}

interface LinkItem {
  label: string
  name: string
  path: string
}

const links = computed(() => {
  const links: LinkItem[] = [{
    name: 'internal',
    label: 'internal_storage',
    path: app.value.internalStoragePath
  }]
  if (app.value.sdcardPath) {
    links.push({
      name: 'sdcard',
      label: 'sdcard',
      path: app.value.sdcardPath
    })
  }
  app.value.usbDiskPaths.forEach((path, index) => {
    links.push({
      name: `usb${index + 1}`,
      label: `usb_storage ${index + 1}`,
      path
    })
  })

  links.push({
    name: 'app',
    label: 'app_name',
    path: app.value.externalFilesDir
  })

  return links
})

function openLink(link: LinkItem) {
  const q = buildQuery([
    {
      name: 'parent',
      op: '',
      value: link.path
    },
    {
      name: 'link_name',
      op: '',
      value: link.name
    },
  ])
  replacePath(mainStore, `/files?q=${encodeBase64(q)}`)
}

function updateActive() {
  const route = router.currentRoute.value
  if (route.path === '/files/recent') {
    recent.value = true
    return
  }

  recent.value = false
  const q = decodeBase64(route.query.q?.toString() ?? '')
  parseQ(filter, q)
  parent.value = filter.parent
}

updateActive()

watch(
  () => router.currentRoute.value.fullPath,
  () => {
    updateActive()
  }
)
</script>
