<template>
  <v-modal :title="$t('add_to_tags')">
    <template #body>
      <multiselect v-model="selectedTags" label="name" track-by="id" :options="tags" />
    </template>
    <template #action>
      <button type="button" :disabled="loading" class="btn" @click="doAction">
        {{ $t('save') }}
      </button>
    </template>
  </v-modal>
</template>
<script setup lang="ts">
import { initMutation, updateTagRelationsGQL } from '@/lib/api/mutation'
import type { ITag, ITagRelationStub } from '@/lib/interfaces'
import emitter from '@/plugins/eventbus'
import { useI18n } from 'vue-i18n'
import toast from '@/components/toaster'
import { ref, type PropType } from 'vue'
import { popModal } from './modal'
import { difference } from 'lodash'

const { t } = useI18n()

const props = defineProps({
  tagType: { type: String, required: true },
  tags: { type: Array as PropType<Array<ITag>>, default: () => [] },
  item: { type: Object as PropType<ITagRelationStub> },
  selected: { type: Array as PropType<Array<ITag>>, default: () => [] },
})

const selectedTags = ref<ITag[]>(props.selected)
const { mutate, loading, onDone } = initMutation({
  document: updateTagRelationsGQL,
  appApi: true,
})

onDone(() => {
  emitter.emit('refetch_by_tag_type', props.tagType)
  toast(t('saved'))
  popModal()
})

const doAction = () => {
  const tagIds = selectedTags.value.map((it: ITag) => it.id)
  const oldTagIds = props.selected.map((it: ITag) => it.id)
  mutate({
    tagType: props.tagType,
    addTagIds: difference(tagIds, oldTagIds),
    item: props.item,
    removeTagIds: difference(oldTagIds, tagIds),
  })
}
</script>
