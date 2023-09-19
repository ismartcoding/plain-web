<template>
  <h2 class="nav-title mt-4">
    {{ $t('tags') }}
    <button class="icon-button" @click.prevent="add" v-tooltip="$t('add_tag')">
      <md-ripple />
      <i-material-symbols:add-rounded />
    </button>
  </h2>
  <ul class="nav">
    <li
      v-for="item in tags"
      @click.prevent="view(item)"
      :key="item.id"
      @contextmenu="itemCtxMenu($event, item)"
      :class="{ active: selected && kebabCase(item.name) === selected }"
    >
      {{ item.name }} ({{ item.count }})
    </li>
  </ul>
</template>

<script setup lang="ts">
import { contextmenu } from '@/components/contextmenu'
import { onMounted, onUnmounted, ref } from 'vue'
import { initQuery, tagsGQL } from '@/lib/api/query'
import { replacePath } from '@/plugins/router'
import type { IMediaItemDeletedEvent, IMediaItemsDeletedEvent, ITag } from '@/lib/interfaces'
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
import emitter from '@/plugins/eventbus'
import { names } from '@/lib/tag'

const props = defineProps({
  type: { type: String, required: true },
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
    type: props.type,
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
      return { type: props.type, name: value }
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
  replacePath(mainStore, `/${names[props.type]}?q=${encodeBase64(q)}`)
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

const refetchTagsHandler = (type: string) => {
  if (type === props.type) {
    refetch()
  }
}

const mediaItemsDeletedHandler = (event: IMediaItemsDeletedEvent) => {
  if (event.type === props.type) {
    refetch()
  }
}

const mediaItemDeletedHandler = (event: IMediaItemDeletedEvent) => {
  if (event.item.tags.length && event.type === props.type) {
    refetch()
  }
}

onMounted(() => {
  emitter.on('refetch_tags', refetchTagsHandler)
  emitter.on('media_items_deleted', mediaItemsDeletedHandler)
  emitter.on('media_item_deleted', mediaItemDeletedHandler)
})

onUnmounted(() => {
  emitter.off('refetch_tags', refetchTagsHandler)
  emitter.off('media_items_deleted', mediaItemsDeletedHandler)
  emitter.off('media_item_deleted', mediaItemDeletedHandler)
})
</script>
