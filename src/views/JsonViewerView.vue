<template>
  <div class="v-toolbar">
    <breadcrumb :current="() => $t('json_viewer')" />
    <md-outlined-button @click.prevent="toggle(true)">{{ $t('expand_all') }}</md-outlined-button>
    <md-outlined-button @click.prevent="toggle(false)">{{ $t('collapse_all') }}</md-outlined-button>
  </div>
  <div class="panel-container">
    <monaco-editor language="json" v-model="json" />
    <json-viewer v-if="jsonData" :value="jsonData" :expand-depth="expandDepth" :key="updateKey" />
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
.panel-container {
  display: grid;
  height: calc(100vh - 132px);
  grid-template-columns: 50% 50%;
}
</style>
