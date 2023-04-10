<template>
  <v-modal :title="$t('add_to_tags')">
    <template #body>
      <multiselect v-model="selectedTags" label="name" track-by="id" :options="tags" />
      <div class="invalid-feedback" v-show="errorMessage">
        {{ errorMessage ? $t(errorMessage) : '' }}
      </div>
    </template>
    <template #action>
      <button type="button" :disabled="loading" class="btn" @click="doAction">
        {{ $t('save') }}
      </button>
    </template>
  </v-modal>
</template>
<script setup lang="ts">
import { addToTagsGQL, initMutation } from '@/lib/api/mutation'
import type { ITag, ITagRelationStub } from '@/lib/interfaces'
import emitter from '@/plugins/eventbus'
import { useField, useForm } from 'vee-validate'
import { useI18n } from 'vue-i18n'
import { array } from 'yup'
import toast from '@/components/toaster'
import type { PropType } from 'vue'
import { popModal } from './modal'

const { handleSubmit } = useForm()
const { t } = useI18n()

const props = defineProps({
  tagType: { type: String, required: true },
  tags: { type: Array as PropType<Array<ITag>>, default: () => [] },
  items: { type: Array as PropType<Array<ITagRelationStub>>, default: () => [] },
})

const { value: selectedTags, errorMessage } = useField(
  'selectedTags',
  array().test(
    'required',
    () => 'valid.required',
    (value: any) => value.length
  ),
  {
    initialValue: [],
  }
)

const { mutate, loading, onDone } = initMutation({
  document: addToTagsGQL,
  appApi: true,
})

onDone(() => {
  if (props.tagType === 'AUDIO') {
    emitter.emit('refetch_app')
  }
  emitter.emit('refetch_by_tag_type', props.tagType)
  toast(t('saved'))
  popModal()
})

const doAction = handleSubmit(() => {
  mutate({
    tagType: props.tagType,
    tagIds: selectedTags.value.map((it: ITag) => it.id),
    items: props.items,
  })
})
</script>
