<template>
  <md-dialog>
    <div slot="headline">
      {{ $t('add_to_tags') }}
    </div>
    <div slot="content">
      <md-chip-set>
        <md-filter-chip v-for="item in tags" :key="item.id" :label="item.name" :selected="selectedTags.includes(item)" @click="onTagSelect(item)" />
      </md-chip-set>
    </div>
    <div slot="actions">
      <md-outlined-button value="cancel" @click="popModal">{{ $t('cancel') }}</md-outlined-button>
      <md-filled-button value="save" :disabled="loading" @click="doAction" autofocus> <md-circular-progress indeterminate v-if="loading" slot="icon" /> {{ $t('save') }} </md-filled-button>
    </div>
  </md-dialog>
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
  appApi: true,
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
