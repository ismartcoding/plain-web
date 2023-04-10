<template>
  <div class="page-container container">
    <div class="main">
      <div class="v-toolbar">
        <breadcrumb :current="() => $t('json_viewer')" />
        <div class="right-actions">
          <button class="btn" @click.prevent="toggle(true)">{{ $t('expand_all') }}</button>
          <button class="btn" @click.prevent="toggle(false)">{{ $t('collapse_all') }}</button>
        </div>
      </div>
      <splitpanes class="panel-container">
        <pane>
          <monaco-editor language="json" v-model="content" />
        </pane>
        <pane>
          <json-viewer v-if="jsonData" :value="jsonData" :expand-depth="expandDepth" :key="updateKey" />
        </pane>
      </splitpanes>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Splitpanes, Pane } from 'splitpanes'
import { ref, watch } from 'vue'

const content = ref('')
const jsonData = ref(null)
const expandDepth = ref(1)
const updateKey = ref(1)

watch(content, (value: string) => {
  try {
    const r = JSON.parse(value)
    jsonData.value = r
    content.value = JSON.stringify(r, null, 4)
  } catch (ex) {
    console.error(ex)
  }
})

function toggle(expand: boolean) {
  if (expand) {
    expandDepth.value = 1000
  } else {
    expandDepth.value = 1
  }
  updateKey.value++ // force update
}
</script>
