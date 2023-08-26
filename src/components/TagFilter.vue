<template>
  <h2 class="nav-title mt-4">
    {{ $t('tags') }}
    <button class="btn btn-sm" type="button" @click.prevent="add">{{ $t('add') }}</button>
  </h2>
  <ul class="nav">
    <li
      v-for="item in tags"
      @click.prevent="view(item)"
      :key="item.id"
      @contextmenu="itemCtxMenu($event, item)"
      :class="{ active: selected && kebabCase(item.name) === selected }"
    >
      {{ item.name }}
    </li>
  </ul>
</template>

<script setup lang="ts">
import { contextmenu } from '@/components/contextmenu'
import { ref } from 'vue'
import { initQuery, tagsGQL } from '@/lib/api/query'
import { replacePath } from '@/plugins/router'
import type { ITag } from '@/lib/interfaces'
import { openModal } from '@/components/modal'
import { useMainStore } from '@/stores/main'
import { encodeBase64 } from '@/lib/strutil'
import { buildQuery } from '@/lib/search'
import { kebabCase } from 'lodash-es'
import toast from '@/components/toaster'
import { useI18n } from 'vue-i18n'
import { initMutation, createTagGQL, deleteTagGQL, updateTagGQL } from '@/lib/api/mutation'
import EditValueModal from '@/components/EditValueModal.vue'
import DeleteConfirm from '@/components/DeleteConfirm.vue'

const props = defineProps({
  tagType: { type: String, required: true },
  selected: { type: String, required: true },
})
const { t } = useI18n()

const mainStore = useMainStore()
const tags = ref<ITag[]>([])

const { refetch } = initQuery({
  handle: (data: any, error: string) => {
    if (error) {
      toast(t(error), 'error')
    } else {
      if (data) {
        tags.value = data.tags
      }
    }
  },
  document: tagsGQL,
  variables: {
    type: props.tagType,
  },
  appApi: true,
})

function add() {
  openModal(EditValueModal, {
    title: t('add_tag'),
    placeholder: t('name'),
    mutation: () => {
      return initMutation({
        document: createTagGQL,
        options: {
          update: () => {
            refetch()
          },
        },
        appApi: true,
      })
    },
    getVariables: (value: string) => {
      return { type: props.tagType, name: value }
    },
  })
}

function view(item: ITag) {
  const q = buildQuery([
    {
      name: 'tag',
      op: '',
      value: kebabCase(item.name),
    },
  ])
  const names: Record<string, string> = {
    NOTE: 'notes',
    AUDIO: 'audios',
    IMAGE: 'images',
    VIDEO: 'videos',
    FEED_ENTRY: 'feeds',
    SMS: 'messages',
    CALL: 'calls',
    CONTACT: 'contacts',
    AI_CHAT: 'aichats',
  }
  replacePath(mainStore, `/${names[props.tagType]}?q=${encodeBase64(q)}`)
}

function itemCtxMenu(e: MouseEvent, item: ITag) {
  e.preventDefault()
  contextmenu({
    x: e.x,
    y: e.y,
    items: [
      {
        label: t('rename'),
        onClick: () => {
          openModal(EditValueModal, {
            title: t('rename'),
            placeholder: t('name'),
            value: item.name,
            mutation: () =>
              initMutation({
                document: updateTagGQL,
                appApi: true,
              }),
            getVariables: (value: string) => {
              return { id: item.id, name: value }
            },
            done: () => {
              refetch()
            },
          })
        },
      },
      {
        label: t('delete'),
        onClick: () => {
          openModal(DeleteConfirm, {
            id: item.id,
            name: item.name,
            gql: deleteTagGQL,
            appApi: true,
            typeName: 'Tag',
          })
        },
      },
    ],
  })
}
</script>
