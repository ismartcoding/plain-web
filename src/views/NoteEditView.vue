<template>
  <div class="v-toolbar">
    <breadcrumb :paths="paths">
      <template #current>
        {{ isCreate() ? t('create') : t('edit') }}
        <span class="state-point" v-show="notsaved">*</span>
        <field-id class="time" v-if="note?.updatedAt" :id="getTime()" :raw="note" />
      </template>
    </breadcrumb>
    <span v-for="tag in note?.tags" :key="tag.id" class="badge">{{ tag.name }}</span>
    <button class="icon-button" v-if="!isCreate()" v-tooltip="$t('add_to_tags')" @click.prevent="addToTags" style="margin-inline-start: 8px">
      <md-ripple />
      <i-material-symbols:label-outline-rounded />
    </button>

    <button class="icon-button" v-if="!isCreate()" v-tooltip="$t('print')" @click.prevent="print">
      <md-ripple />
      <i-material-symbols:print-outline-rounded />
    </button>
  </div>
  <div class="panel-container">
    <monaco-editor language="html" v-model="content" />
    <div class="md-container" v-html="markdown"></div>
  </div>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import toast from '@/components/toaster'
import { useI18n } from 'vue-i18n'
import { initQuery, noteGQL, tagsGQL } from '@/lib/api/query'
import type { IItemTagsUpdatedEvent, IItemsTagsUpdatedEvent, INote, ITag } from '@/lib/interfaces'
import { formatDateTime } from '@/lib/format'
import { useMarkdown } from '@/hooks/markdown'
import { initMutation, saveNoteGQL } from '@/lib/api/mutation'
import { debounce, truncate } from 'lodash-es'
import { replacePathNoReload } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import { useTempStore } from '@/stores/temp'
import { storeToRefs } from 'pinia'
import { openModal } from '@/components/modal'
import UpdateTagRelationsModal from '@/components/UpdateTagRelationsModal.vue'
import emitter from '@/plugins/eventbus'

const mainStore = useMainStore()

const { t } = useI18n()

const route = useRoute()
const id = ref(route.params.id)
const note = ref<INote>()
const content = ref('')
const markdown = ref('')
const notsaved = ref(false)

const { app, urlTokenKey } = storeToRefs(useTempStore())

const paths = computed(() => {
  if (note.value?.deletedAt) {
    return ['/notes', '/notes/trash']
  }

  return ['/notes']
})

const { render } = useMarkdown(app, urlTokenKey)
let init = false
function isCreate() {
  return id.value === 'create'
}

const saveContent = debounce(() => {
  notsaved.value = false
  save({
    id: isCreate() ? '' : id.value,
    input: {
      content: content.value,
      title: truncate(content.value, { length: 100, omission: '' }),
    },
  })
}, 500)

const watchContent = () => {
  watch(content, async (value: string) => {
    notsaved.value = true
    markdown.value = await render(value)
    saveContent()
  })
}

const print = () => {
  window.print()
}

const tags = ref<ITag[]>()
const dataType = 'NOTE'
initQuery({
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
    type: dataType,
  },
  appApi: true,
})

let refecthEntry = () => {}
if (!isCreate()) {
  const { refetch } = initQuery({
    handle: async (data: any, error: string) => {
      if (error) {
        toast(t(error), 'error')
      } else {
        note.value = data.note
        if (init) {
          return
        }
        content.value = data.note.content
        markdown.value = await render(content.value)
        init = true
        watchContent()
      }
    },
    document: noteGQL,
    variables: () => ({
      id: id.value,
    }),
    appApi: true,
  })
  refecthEntry = refetch
} else {
  watchContent()
}

const { mutate: save, onDone: saveDone } = initMutation({
  document: saveNoteGQL,
  appApi: true,
})

saveDone((r: any) => {
  note.value = r.data.saveNote
  const create = isCreate()
  if (create && note.value?.id) {
    id.value = note.value?.id
    replacePathNoReload(mainStore, `/notes/${id.value}`)
  }
})

function getTime() {
  const time = note?.value?.updatedAt
  if (time) {
    return `(${t('updated_at')}: ${formatDateTime(time)})`
  }
  return ''
}

function addToTags() {
  openModal(UpdateTagRelationsModal, {
    type: dataType,
    tags: tags.value,
    item: {
      key: note.value?.id,
      title: '',
      size: 0,
    },
    selected: tags.value?.filter((it: ITag) => note.value?.tags.some((t) => t.id === it.id)),
  })
}

const itemsTagsUpdatedHandler = (event: IItemsTagsUpdatedEvent) => {
  if (event.type === dataType) {
    refecthEntry()
  }
}

const itemTagsUpdatedHandler = (event: IItemTagsUpdatedEvent) => {
  if (event.type === dataType) {
    refecthEntry()
  }
}

onMounted(() => {
  emitter.on('item_tags_updated', itemTagsUpdatedHandler)
  emitter.on('items_tags_updated', itemsTagsUpdatedHandler)
})

onUnmounted(() => {
  emitter.off('item_tags_updated', itemTagsUpdatedHandler)
  emitter.off('items_tags_updated', itemsTagsUpdatedHandler)
})
</script>
<style lang="scss" scoped>
.panel-container {
  display: flex;
  flex-direction: row;
  height: calc(100vh - 120px);
}

.time {
  margin-left: 8px;
  font-size: 0.875rem;
  font-weight: normal;
}

.state-point {
  color: red;
}

.monaco-editor {
  width: 50% !important;
}
.md-container {
  width: 50%;
  padding: 16px;
  height: 100%;
  box-sizing: border-box;
  position: relative;
  overflow-y: auto;
}
</style>
