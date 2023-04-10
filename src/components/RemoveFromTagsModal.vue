<template>
  <v-modal :title="$t('remove_from_tags')">
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
import { initMutation, removeFromTagsGQL } from '@/lib/api/mutation'
import type { ITag } from '@/lib/interfaces'
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
  ids: { type: Array as PropType<Array<string>>, default: () => [] },
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
  document: removeFromTagsGQL,
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
    tagIds: selectedTags.value.map((it: ITag) => it.id),
    keys: props.ids,
  })
})
</script>
