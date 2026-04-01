import { useRoute } from 'vue-router'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import toast from '@/components/toaster'
import { useI18n } from 'vue-i18n'
import { initLazyQuery, initQuery, noteGQL, tagsGQL } from '@/lib/api/query'
import type { IItemTagsUpdatedEvent, IItemsTagsUpdatedEvent, INote, ITag } from '@/lib/interfaces'
import { formatDateTime } from '@/lib/format'
import { useMarkdown } from '@/hooks/markdown'
import { initMutation, saveNoteGQL } from '@/lib/api/mutation'
import { debounce } from '@/lib/array'
import router, { replacePath, replacePathNoReload } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import { useTempStore } from '@/stores/temp'
import { storeToRefs } from 'pinia'
import { openModal } from '@/components/modal'
import UpdateTagRelationsModal from '@/components/UpdateTagRelationsModal.vue'
import emitter from '@/plugins/eventbus'
import { upload as uploadFile } from '@/lib/upload/upload'
import { shortUUID } from '@/lib/strutil'
import type { IUploadItem } from '@/stores/temp'

const dataType = 'NOTE'

export type ViewMode = 'editor' | 'preview'

export function useNoteEdit() {
  const mainStore = useMainStore()
  const { t } = useI18n()
  const route = useRoute()
  const id = ref('')
  const note = ref<INote>()
  const title = ref('')
  const content = ref('')
  const markdown = ref('')
  const notSaved = ref(false)
  const viewMode = ref<ViewMode>('editor')
  const uploadingImage = ref(false)
  const { app, urlTokenKey } = storeToRefs(useTempStore())

  function backToList() {
    const q = router.currentRoute.value.query.q
    replacePath(mainStore, q ? `/notes?q=${q}` : '/notes')
  }

  const { render } = useMarkdown(app, urlTokenKey)

  const { mutate: save, onDone: saveDone } = initMutation({ document: saveNoteGQL })
  saveDone((r: any) => {
    note.value = r.data.saveNote
    if (!id.value && note.value?.id) {
      id.value = note.value.id
      replacePathNoReload(mainStore, `/notes/${id.value}`)
    }
  })

  const saveContent = debounce(() => {
    notSaved.value = false
    save({ id: id.value, input: { content: content.value, title: title.value || content.value.substring(0, 250) } })
  }, 500)

  const saveTitle = debounce(() => {
    notSaved.value = false
    save({ id: id.value, input: { content: content.value, title: title.value || content.value.substring(0, 250) } })
  }, 500)

  const watchContent = () => {
    watch(content, async (value: string) => {
      notSaved.value = true
      markdown.value = await render(value)
      saveContent()
    })
    watch(title, () => {
      notSaved.value = true
      saveTitle()
    })
  }

  const tags = ref<ITag[]>()
  initQuery({
    handle: (data: { tags: ITag[] }, error: string) => {
      if (error) toast(t(error), 'error')
      else if (data) tags.value = data.tags
    },
    document: tagsGQL,
    variables: { type: dataType },
  })

  const { fetch } = initLazyQuery({
    handle: async (data: { note: INote }, error: string) => {
      if (error) toast(t(error), 'error')
      else {
        note.value = data.note
        title.value = data.note.title
        content.value = data.note.content
        markdown.value = await render(content.value)
        watchContent()
      }
    },
    document: noteGQL,
    variables: () => ({ id: id.value }),
    options: { fetchPolicy: 'no-cache' },
  })

  function getTime() {
    const time = note?.value?.updatedAt
    return time ? `(${t('updated_at')}: ${formatDateTime(time)})` : ''
  }

  function addToTags() {
    openModal(UpdateTagRelationsModal, {
      type: dataType, tags: tags.value,
      item: { key: note.value?.id, title: '', size: 0 },
      selected: tags.value?.filter((it: ITag) => note.value?.tags.some((t) => t.id === it.id)),
    })
  }

  const print = () => window.print()

  async function handlePasteImages(files: File[]): Promise<string[]> {
    uploadingImage.value = true
    const insertedPaths: string[] = []
    try {
      const appDir = app.value.appDir
      const noteImgDir = `${appDir}/note-images`
      for (const file of files) {
        const ext = file.name.split('.').pop() || 'png'
        const fileName = `${shortUUID()}.${ext}`
        const item: IUploadItem = {
          id: shortUUID(),
          dir: noteImgDir,
          fileName,
          file,
          status: 'pending',
          uploadedSize: 0,
          error: '',
          isAppFile: false,
        }
        const result = (await uploadFile(item, false)) as { fileName?: string; error?: string } | undefined
        if (result && result.fileName) {
          insertedPaths.push(`![image](app://note-images/${result.fileName})`)
        }
      }
    } finally {
      uploadingImage.value = false
    }
    return insertedPaths
  }

  function setViewMode(mode: ViewMode) {
    viewMode.value = mode
  }

  onMounted(() => {
    id.value = route.params.id as string
    if (id.value === 'create') id.value = ''
    if (id.value) fetch()
    else watchContent()
    emitter.on('item_tags_updated', (event: IItemTagsUpdatedEvent) => { if (event.type === dataType) fetch() })
    emitter.on('items_tags_updated', (event: IItemsTagsUpdatedEvent) => { if (event.type === dataType) fetch() })
  })

  onUnmounted(() => {
    emitter.off('item_tags_updated')
    emitter.off('items_tags_updated')
  })

  return {
    id, note, title, content, markdown, notSaved, dataType, viewMode,
    uploadingImage, t, backToList, getTime, addToTags, print,
    handlePasteImages, setViewMode,
  }
}
