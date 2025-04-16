<template>
  <md-dialog>
    <div slot="headline">
      {{ $t('tags') }}
    </div>
    <div slot="content">
      <md-outlined-segmented-button-set @segmented-button-set-selection="onModeSelected">
        <md-outlined-segmented-button data-value="add_to_tags" :label="$t('add_to_tags')" :selected="mode === 'add_to_tags'">
          <i-material-symbols:label-outline-rounded slot="icon" />
        </md-outlined-segmented-button>
        <md-outlined-segmented-button data-value="remove_from_tags" :label="$t('remove_from_tags')" :selected="mode === 'remove_from_tags'">
          <i-material-symbols:label-off-outline-rounded slot="icon" />
        </md-outlined-segmented-button>
      </md-outlined-segmented-button-set>
      <md-chip-set>
        <md-filter-chip v-for="item in tags" :key="item.id" :label="item.name" :selected="selectedTags.includes(item)" @click="onTagSelect(item)" />
      </md-chip-set>
      <div v-show="errorMessage" class="invalid-feedback">
        {{ errorMessage ? $t(errorMessage) : '' }}
      </div>
    </div>
    <div slot="actions">
      <md-outlined-button value="cancel" @click="popModal">{{ $t('cancel') }}</md-outlined-button>
      <md-filled-button value="save" :disabled="adding || removing" autofocus @click="doAction">
        <md-circular-progress v-if="adding || removing" slot="icon" indeterminate /> {{ $t('save') }}
      </md-filled-button>
    </div>
  </md-dialog>
</template>
<script setup lang="ts">
import { addToTagsGQL, initMutation, removeFromTagsGQL } from '@/lib/api/mutation'
import type { ITag } from '@/lib/interfaces'
import emitter from '@/plugins/eventbus'
import { useField, useForm } from 'vee-validate'
import { array } from 'yup'
import { ref, type PropType } from 'vue'
import { popModal } from './modal'
import { remove } from 'lodash-es'
import type { MdOutlinedSegmentedButton } from '@material/web/labs/segmentedbutton/outlined-segmented-button'

const { handleSubmit } = useForm()
const mode = ref('add_to_tags')

const props = defineProps({
  type: { type: String, required: true },
  tags: { type: Array as PropType<Array<ITag>>, default: () => [] },
  query: { type: String, required: true },
})

function onModeSelected(
  e: CustomEvent<{
    button: MdOutlinedSegmentedButton
    selected: boolean
    index: number
  }>
) {
  const { button } = e.detail
  const value = button.dataset.value as string
  mode.value = value
}

const { value: selectedTags, errorMessage } = useField<ITag[]>(
  'selectedTags',
  array().test('required', 'valid.required', (value: any) => value.length),
  {
    initialValue: [],
  }
)

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
    remove(selectedTags.value, (it: ITag) => it.id === item.id)
  } else {
    selectedTags.value.push(item)
  }
}

const doAction = handleSubmit(() => {
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
})
</script>
<style lang="scss" scoped>
md-outlined-segmented-button-set {
  margin-block-end: 16px;
}
</style>
