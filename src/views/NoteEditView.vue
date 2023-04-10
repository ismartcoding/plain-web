<template>
  <div class="page-container container-fluid">
    <div class="main">
      <breadcrumb :paths="paths">
        <template #current>
          {{ id === 'create' ? t('create') : t('edit') }}<span class="time">{{ getTime() }}</span>
        </template>
      </breadcrumb>
      <splitpanes class="panel-container">
        <pane>
          <monaco-editor language="html" v-model="content" />
        </pane>
        <pane class="markdown-panel">
          <div class="md-container" v-html="markdown"></div>
        </pane>
      </splitpanes>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Splitpanes, Pane } from 'splitpanes'
import { useRoute } from 'vue-router'
import { computed, ref, watch } from 'vue'
import toast from '@/components/toaster'
import { useI18n } from 'vue-i18n'
import { initQuery, noteGQL } from '@/lib/api/query'
import type { INote } from '@/lib/interfaces'
import { formatDateTime } from '@/lib/format'
import { useMarkdown } from './hooks/markdown'
import { initMutation, saveNoteGQL } from '@/lib/api/mutation'
import { debounce, truncate } from 'lodash-es'
import { replacePathNoReload } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import { useTempStore } from '@/stores/temp'
import { storeToRefs } from 'pinia'

const mainStore = useMainStore()

const { t } = useI18n()

const route = useRoute()
const id = ref(route.params.id)
const note = ref<INote>()
const content = ref('')
const markdown = ref('')

const { app } = storeToRefs(useTempStore())

const paths = computed(() => {
  if (note.value?.deletedAt) {
    return ['/notes', '/notes/trash']
  }

  return ['/notes']
})

const { render } = useMarkdown(app)
let init = false
function isCreate() {
  return id.value === 'create'
}

const saveContent = debounce(() => {
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
    markdown.value = await render(value)
    saveContent()
  })
}

if (!isCreate()) {
  initQuery({
    handle: async (data: any, error: string) => {
      if (error) {
        toast(t(error), 'error')
      } else {
        if (init) {
          return
        }
        note.value = data.note
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
  if (create) {
    id.value = note.value?.id!
    replacePathNoReload(mainStore, `/notes/${note.value?.id}`)
  }
})

function getTime() {
  const time = note?.value?.updatedAt
  if (time) {
    return `(${t('updated_at')}: ${formatDateTime(time)})`
  }
  return ''
}
</script>
<style lang="scss" scoped>
.time {
  margin-left: 8px;
  font-size: 0.875rem;
  font-weight: normal;
}

.md-container {
  padding: 16px;
  height: 100%;
  overflow: auto;
}
</style>
