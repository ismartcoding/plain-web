<template>
  <div class="top-app-bar">
    <div class="btn-icon no-click">
      <i-material-symbols:label-outline-rounded />
    </div>
    <div class="title">{{ $t('tags') }}</div>
    <div class="actions">
      <button class="btn-icon" @click.prevent="add" v-tooltip="$t('add_tag')">
        <md-ripple />
        <i-material-symbols:add-rounded />
      </button>
    </div>
  </div>
  <ul class="nav">
    <li v-for="item in tags" @click.prevent="view(item)" :key="item.id" :class="{ active: item.id === selected }">
      <span class="title">{{ item.name }}</span>
      <button :id="'tag-' + item.id" class="btn-icon sm" @click.prevent.stop="showMenu(item)" v-tooltip="$t('actions')">
        <md-ripple />
        <i-material-symbols:more-vert />
      </button>
      <span class="count">{{ item.count.toLocaleString() }}</span>
    </li>
  </ul>
  <md-menu positioning="popover" :anchor="'tag-' + selectedItem?.id" stay-open-on-focusout quick :open="tagMenuVisible" @closed="tagMenuVisible = false">
    <md-menu-item @click="renameTag(selectedItem!)">
      <div slot="headline">{{ $t('rename') }}</div>
    </md-menu-item>
    <md-menu-item @click="deleteTag(selectedItem!)">
      <div slot="headline">{{ $t('delete') }}</div>
    </md-menu-item>
  </md-menu>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { initQuery, tagsGQL } from '@/lib/api/query'
import { replacePath } from '@/plugins/router'
import type { IMediaItemsActionedEvent, ITag } from '@/lib/interfaces'
import { openModal } from '@/components/modal'
import { useMainStore } from '@/stores/main'
import { encodeBase64 } from '@/lib/strutil'
import { buildQuery } from '@/lib/search'
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
const tagMenuVisible = ref(false)
const selectedItem = ref<ITag>()

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

function showMenu(item: ITag) {
  selectedItem.value = item
  tagMenuVisible.value = true
}

function renameTag(item: ITag) {
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
}

function deleteTag(item: ITag) {
  openModal(DeleteConfirm, {
    id: item.id,
    name: item.name,
    gql: deleteTagGQL,
    appApi: true,
    typeName: 'Tag',
  })
}

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
      name: 'tag_id',
      op: '',
      value: item.id,
    },
  ])
  replacePath(mainStore, `/${names[props.type]}?q=${encodeBase64(q)}`)
}

const refetchTagsHandler = (type: string) => {
  if (type === props.type) {
    refetch()
  }
}

const mediaItemsActionedHandler = (event: IMediaItemsActionedEvent) => {
  if (event.type === props.type) {
    refetch()
  }
}

onMounted(() => {
  emitter.on('refetch_tags', refetchTagsHandler)
  emitter.on('media_items_actioned', mediaItemsActionedHandler)
})

onUnmounted(() => {
  emitter.off('refetch_tags', refetchTagsHandler)
  emitter.off('media_items_actioned', mediaItemsActionedHandler)
})
</script>
