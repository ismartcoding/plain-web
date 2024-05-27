<template>
  <div class="tags">
    <a v-for="tag in tags" @click.stop.prevent="view(tag)">#{{ tag.name }}</a>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { replacePath } from '@/plugins/router'
import type { ITag } from '@/lib/interfaces'
import { useMainStore } from '@/stores/main'
import { encodeBase64 } from '@/lib/strutil'
import { buildQuery } from '@/lib/search'
import { kebabCase } from 'lodash-es'
import { names } from '@/lib/tag'

const props = defineProps({
  type: { type: String },
  tags: { type: Object as PropType<Array<ITag>>, default: [], required: true },
})
const mainStore = useMainStore()

function view(item: ITag) {
  if (!props.type) {
    return
  }
  const q = buildQuery([
    {
      name: 'tag',
      op: '',
      value: kebabCase(item.name),
    },
  ])
  replacePath(mainStore, `/${names[props.type]}?q=${encodeBase64(q)}`)
}
</script>

<style scoped lang="scss">
.tags {
  a {
    white-space: nowrap;
    margin-inline-end: 8px;
    cursor: pointer;
  }
  a:last-child {
    margin-inline-end: 0;
  }
}
</style>