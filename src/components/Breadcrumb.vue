<template>
  <ol class="breadcrumb">
    <li v-for="item of props.paths" :key="item">
      <a href="#" @click.prevent="go(item)">{{ $t(`page_title.${getRouteName(item)}`) }}</a>
    </li>
    <li class="active">{{ typeof current === 'function' ? current() : current }}<slot name="current" /></li>
  </ol>
</template>
<script setup lang="ts">
import { replacePath, getRouteName } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import type { PropType } from 'vue'
const store = useMainStore()

const props = defineProps({
  current: { type: [String, Function] },
  paths: { type: Array as PropType<Array<string>>, default: () => [] },
})

function go(fullPath: string) {
  replacePath(store, fullPath)
}
</script>
<style lang="scss" scoped>
.breadcrumb {
  display: flex;
  flex-wrap: wrap;
  padding: 0;
  margin: 0;
  list-style: none;
  font-weight: 600;
  font-size: 1.25rem;

  li {
    + li {
      padding-left: 0.5rem;

      &::before {
        float: left;
        padding-right: 0.5rem;
        content: '/';
      }
    }
  }
}
</style>
