<template>
  <a class="btn-feature" :href="props.path" @click.prevent.stop="openTab(props.path)">
    <slot name="icon" />
    <div class="info">
      <span class="name">{{ $t(props.name) }}</span>
      <span v-if="props.count !== undefined" class="count" :style="{ visibility: props.count >= 0 ? 'visible' : 'hidden' }">{{ count.toLocaleString() }}</span>
    </div>
  </a>
</template>
<script setup lang="ts">
import { replacePath } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
const mainStore = useMainStore()

const props = defineProps({
  name: { type: String, required: true },
  count: { type: Number },
  path: { type: String, default: '' },
})

function openTab(fullPath: string) {
  replacePath(mainStore, fullPath)
}
</script>
