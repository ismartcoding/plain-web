<template>
  <left-sidebar>
    <template #body>
      <ul class="nav">
        <li :class="{ active: activeSection === 'datastore' }" @click.prevent="navigate('/developer/datastore')">
          <span class="icon" aria-hidden="true"><i-lucide:archive /></span>
          <span class="title">{{ $t('developer.datastore') }}</span>
        </li>
        <li :class="{ active: activeSection === 'database' }" @click.prevent="navigate('/developer/database')">
          <span class="icon" aria-hidden="true"><i-lucide:database /></span>
          <span class="title">{{ $t('developer.database') }}</span>
        </li>
        <li :class="{ active: activeSection === 'logs' }" @click.prevent="navigate('/developer/logs')">
          <span class="icon" aria-hidden="true"><i-lucide:scroll-text /></span>
          <span class="title">{{ $t('developer.logs') }}</span>
        </li>
      </ul>
    </template>
  </left-sidebar>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import router, { replacePath } from '@/plugins/router'
import { useMainStore } from '@/stores/main'

const mainStore = useMainStore()

const activeSection = computed(() => {
  const path = router.currentRoute.value.path
  if (path.startsWith('/developer/datastore')) return 'datastore'
  if (path.startsWith('/developer/database')) return 'database'
  if (path.startsWith('/developer/logs')) return 'logs'
  return ''
})

function navigate(path: string) {
  replacePath(mainStore, path)
}
</script>
