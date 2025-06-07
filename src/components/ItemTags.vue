<template>
  <template v-if="onlyLinks">
    <a v-for="tag in tags" :key="tag.id" @click.stop.prevent="view(tag)">#{{ tag.name }}</a>
  </template>
  <div v-else-if="tags.length" class="tags">
    <a v-for="tag in tags" :key="tag.id" @click.stop.prevent="view(tag)">#{{ tag.name }}</a>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { replacePath } from '@/plugins/router'
import type { ITag } from '@/lib/interfaces'
import { useMainStore } from '@/stores/main'
import { encodeBase64 } from '@/lib/strutil'
import { buildQuery } from '@/lib/search'
import { names } from '@/lib/tag'

const props = defineProps({
  type: { type: String, default: '' },
  onlyLinks: { type: Boolean, default: false },
  tags: { type: Array as PropType<ITag[]>, default: () => [] },
})
const mainStore = useMainStore()

function view(item: ITag) {
  if (!props.type) {
    return
  }
  const q = buildQuery([
    {
      name: 'tag_id',
      op: '',
      value: item.id,
    },
  ])
  replacePath(mainStore, `/${names[props.type]}?q=${encodeBase64(q)}`)
}
</script>

<style scoped lang="scss">
a {
  white-space: nowrap;
  margin-inline-end: 8px;
}
a:last-child {
  margin-inline-end: 0;
}
</style>
