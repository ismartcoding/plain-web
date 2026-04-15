<template>
  <v-modal @close="popModal">
    <template #headline>
      {{ $t('tags') }}
    </template>
    <template #content>
      <div class="button-group">
        <button :class="{ 'selected': mode === 'add_to_tags' }" @click="mode = 'add_to_tags'">
          {{ $t('add_to_tags') }}
        </button>
        <button :class="{ 'selected': mode === 'remove_from_tags' }" @click="mode = 'remove_from_tags'">
          {{ $t('remove_from_tags') }}
        </button>
      </div>
      <v-chip-set>
        <v-filter-chip v-for="item in tags" :key="item.id" :label="item.name" :selected="selectedTags.includes(item)" @click="onTagSelect(item)" />
      </v-chip-set>
      <div v-show="errorMessage" class="invalid-feedback">
        {{ errorMessage ? $t(errorMessage) : '' }}
      </div>
    </template>
    <template #actions>
      <v-outlined-button value="cancel" @click="popModal">{{ $t('cancel') }}</v-outlined-button>
      <v-filled-button value="save" :loading="adding || removing" @click="doAction">
        {{ $t('save') }}
      </v-filled-button>
    </template>
  </v-modal>
</template>
<script setup lang="ts">
import { addToTagsGQL, initMutation, removeFromTagsGQL } from '@/lib/api/mutation'
import type { ITag } from '@/lib/interfaces'
import emitter from '@/plugins/eventbus'
import { ref, type PropType } from 'vue'
import { popModal } from './modal'
import { arrayRemove } from '@/lib/array'

const mode = ref('add_to_tags')
const selectedTags = ref<ITag[]>([])
const errorMessage = ref('')

const props = defineProps({
  type: { type: String, required: true },
  tags: { type: Array as PropType<Array<ITag>>, default: () => [] },
  query: { type: String, required: true },
})

const {
  mutate: removeFromTags,
  loading: removing,
  onDone: onRemoved,
} = initMutation({
  document: removeFromTagsGQL,
})

const {
  mutate: addToTags,
  loading: adding,
  onDone: onAdded,
} = initMutation({
  document: addToTagsGQL,
})

const onDone = () => {
  emitter.emit('items_tags_updated', { type: props.type })
  emitter.emit('refetch_tags', props.type)
  popModal()
}

onAdded(onDone)
onRemoved(onDone)

function onTagSelect(item: ITag) {
  if (selectedTags.value.includes(item)) {
    arrayRemove(selectedTags.value, (it: ITag) => it.id === item.id)
  } else {
    selectedTags.value.push(item)
  }
}

function doAction() {
  if (selectedTags.value.length === 0) { errorMessage.value = 'valid.required'; return }
  errorMessage.value = ''
  if (mode.value === 'add_to_tags') {
    addToTags({
      type: props.type,
      tagIds: selectedTags.value.map((it: ITag) => it.id),
      query: props.query,
    })
  } else {
    removeFromTags({
      type: props.type,
      tagIds: selectedTags.value.map((it: ITag) => it.id),
      query: props.query,
    })
  }
}
</script>
<style lang="scss" scoped>
.button-group {
  margin-block-end: 16px;
}
</style>
