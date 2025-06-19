<template>
  <v-modal @close="popModal">
    <template #headline>
      {{ $t('add_to_tags') }}
    </template>
    <template #content>
      <v-chip-set>
        <v-filter-chip v-for="tag in tags" :key="tag.id" :label="tag.name" :selected="selectedTags.includes(tag)" @click="onTagSelect(tag)" />
      </v-chip-set>
    </template>
    <template #actions>
      <v-outlined-button value="cancel" @click="popModal">{{ $t('cancel') }}</v-outlined-button>
      <v-filled-button value="save" :loading="loading" @click="doAction">
        {{ $t('save') }}
      </v-filled-button>
    </template>
  </v-modal>
</template>
<script setup lang="ts">
import { initMutation, updateTagRelationsGQL } from '@/lib/api/mutation'
import type { ITag, ITagRelationStub } from '@/lib/interfaces'
import emitter from '@/plugins/eventbus'
import { ref, type PropType } from 'vue'
import { popModal } from './modal'
import { difference } from 'lodash'
import { remove } from 'lodash-es'

const props = defineProps({
  type: { type: String, required: true },
  tags: { type: Array as PropType<Array<ITag>>, default: () => [] },
  item: { type: Object as PropType<ITagRelationStub>, required: true },
  selected: { type: Array as PropType<Array<ITag>>, default: () => [] },
})

const selectedTags = ref<ITag[]>([...props.selected])
const { mutate, loading, onDone } = initMutation({
  document: updateTagRelationsGQL,
})

onDone(() => {
  emitter.emit('item_tags_updated', { item: props.item, type: props.type })
  emitter.emit('refetch_tags', props.type)
  popModal()
})

function onTagSelect(item: ITag) {
  if (selectedTags.value.includes(item)) {
    remove(selectedTags.value, (it: ITag) => it.id === item.id)
  } else {
    selectedTags.value.push(item)
  }
}

const doAction = () => {
  const tagIds = selectedTags.value.map((it: ITag) => it.id)
  const oldTagIds = props.selected.map((it: ITag) => it.id)
  mutate({
    type: props.type,
    addTagIds: difference(tagIds, oldTagIds),
    item: props.item,
    removeTagIds: difference(oldTagIds, tagIds),
  })
}
</script>
