<template>
  <aside class="sidebar" :class="{ mini: miniSidebar }">
    <h2 class="nav-title">
      <button class="icon-button" v-tooltip="$t(miniSidebar ? 'open' : 'close')" @click.prevent="toggleSidebar">
        <md-ripple />
        <i-material-symbols:left-panel-open-outline-rounded v-if="miniSidebar" />
        <i-material-symbols:left-panel-close-outline-rounded v-else />
      </button>
      <div class="title">
        <slot name="title" />
      </div>
      <div class="actions" style="position: relative">
        <slot name="actions" />
      </div>
    </h2>
    <div class="sidebar-body">
      <slot name="body" />
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import router from '@/plugins/router'
import { useMainStore } from '@/stores/main'

const mainStore = useMainStore()

const miniSidebar = ref(mainStore.getCurrentPage(router.currentRoute.value.fullPath).sidebar === false)

function toggleSidebar() {
  miniSidebar.value = !miniSidebar.value
  mainStore.updatePageSidebar(router.currentRoute.value.fullPath, !miniSidebar.value)
}
</script>
