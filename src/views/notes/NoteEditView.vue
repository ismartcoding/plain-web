<!-- eslint-disable vue/no-v-html -->
<template>
  <div class="top-app-bar">
    <v-icon-button v-tooltip="$t('back')" @click.prevent="backToList">
      <i-material-symbols:arrow-back-rounded />
    </v-icon-button>
    <div class="title">{{ id ? t('edit') : t('create') }} <span v-show="notSaved" class="state-point">*</span> <field-id v-if="note?.updatedAt" :id="getTime()" class="time" :raw="note" /></div>
    <div class="actions">
      <item-tags :tags="note?.tags" :type="dataType" :only-links="true" />
      <template v-if="id">
        <v-icon-button v-tooltip="$t('add_to_tags')" @click.prevent="addToTags">
          <i-material-symbols:label-outline-rounded />
        </v-icon-button>
        <v-icon-button v-tooltip="$t('print')" @click.prevent="print">
          <i-material-symbols:print-outline-rounded />
        </v-icon-button>
      </template>
    </div>
  </div>
  <div class="panel-container">
    <monaco-editor v-model="content" language="html" />
    <div class="md-container" v-html="markdown"></div>
  </div>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import toast from '@/components/toaster'
import { useI18n } from 'vue-i18n'
import { initLazyQuery, initQuery, noteGQL, tagsGQL } from '@/lib/api/query'
import type { IItemTagsUpdatedEvent, IItemsTagsUpdatedEvent, INote, ITag } from '@/lib/interfaces'
import { formatDateTime } from '@/lib/format'
import { useMarkdown } from '@/hooks/markdown'
import { initMutation, saveNoteGQL } from '@/lib/api/mutation'
import { debounce, truncate } from 'lodash-es'
import router, { replacePath, replacePathNoReload } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import { useTempStore } from '@/stores/temp'
import { storeToRefs } from 'pinia'
import { openModal } from '@/components/modal'
import UpdateTagRelationsModal from '@/components/UpdateTagRelationsModal.vue'
import emitter from '@/plugins/eventbus'

const mainStore = useMainStore()

const { t } = useI18n()

const route = useRoute()
const id = ref('')
const note = ref<INote>()
const content = ref('')
const markdown = ref('')
const notSaved = ref(false)

const { app, urlTokenKey } = storeToRefs(useTempStore())

function backToList() {
  const q = router.currentRoute.value.query.q
  let path = '/notes'
  if (q) {
    path += `?q=${q}`
  }

  replacePath(mainStore, path)
}

const { render } = useMarkdown(app, urlTokenKey)
const saveContent = debounce(() => {
  notSaved.value = false
  save({
    id: id.value,
    input: {
      content: content.value,
      title: truncate(content.value, { length: 250, omission: '' }),
    },
  })
}, 500)

const watchContent = () => {
  watch(content, async (value: string) => {
    notSaved.value = true
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
  handle: (data: { tags: ITag[] }, error: string) => {
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
})

const { fetch } = initLazyQuery({
  handle: async (data: { note: INote }, error: string) => {
    if (error) {
      toast(t(error), 'error')
    } else {
      note.value = data.note
      content.value = data.note.content
      markdown.value = await render(content.value)
      watchContent()
    }
  },
  document: noteGQL,
  variables: () => ({
    id: id.value,
  }),
  options: {
    fetchPolicy: 'no-cache',
  },
})

const { mutate: save, onDone: saveDone } = initMutation({
  document: saveNoteGQL,
})

saveDone((r: any) => {
  note.value = r.data.saveNote
  if (!id.value && note.value?.id) {
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
    fetch()
  }
}

const itemTagsUpdatedHandler = (event: IItemTagsUpdatedEvent) => {
  if (event.type === dataType) {
    fetch()
  }
}

onMounted(() => {
  id.value = route.params.id as string
  if (id.value === 'create') {
    id.value = ''
  }
  if (id.value) {
    fetch()
  } else {
    watchContent()
  }
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
