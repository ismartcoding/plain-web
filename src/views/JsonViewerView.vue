<template>
  <div class="top-app-bar">
    <div class="title">{{ $t('json_viewer') }}</div>
    <div class="actions">
      <v-outlined-button class="btn-sm" @click.prevent="toggle(true)">{{ $t('expand_all') }}</v-outlined-button>
      <v-outlined-button class="btn-sm" @click.prevent="toggle(false)">{{ $t('collapse_all') }}</v-outlined-button>
    </div>
  </div>
  <div class="scroll-content">
    <monaco-editor v-model="json" language="json" />
    <json-viewer v-if="jsonData" :key="updateKey" :value="jsonData" :expand-depth="expandDepth" />
  </div>
</template>

<script setup lang="ts">
import { useMainStore } from '@/stores/main'
import { storeToRefs } from 'pinia'
import { ref, watch } from 'vue'

const { json } = storeToRefs(useMainStore())

const jsonData = ref(null)
const expandDepth = ref(1)
const updateKey = ref(1)

const updateTree = () => {
  try {
    const r = JSON.parse(json.value)
    jsonData.value = r
  } catch (ex) {
    console.error(ex)
  }
}
watch(json, updateTree)

updateTree()

function toggle(expand: boolean) {
  if (expand) {
    expandDepth.value = 1000
  } else {
    expandDepth.value = 1
  }
  updateKey.value++ // force update
}
</script>
<style lang="scss" scoped>
.scroll-content {
  display: grid;
  height: calc(100vh - 132px);
  grid-template-columns: 50% 50%;
}
.jv-container {
  padding: 0 24px;
}
</style>
