import { ref } from 'vue'
import type { INote, ITag } from '@/lib/interfaces'
import { openModal } from '@/components/modal'
import DeleteConfirm from '@/components/DeleteConfirm.vue'
import UpdateTagRelationsModal from '@/components/UpdateTagRelationsModal.vue'
import { truncateText } from '@/lib/array'
import { useDelete } from '@/hooks/list'
import { useAddToTags } from '@/hooks/tags'
import { deleteNotesGQL, exportNotesGQL, initMutation, deleteNoteGQL } from '@/lib/api/mutation'
import { useNotesRestore, useNotesTrash } from '@/hooks/notes'
import router, { replacePath } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import { DataType } from '@/lib/data'
import type { Ref } from 'vue'
import JSZip from 'jszip'

interface UseNotesActionsOptions {
  items: Ref<INote[]>
  selectedIds: Ref<string[]>
  realAllChecked: Ref<boolean>
  q: Ref<string>
  total: Ref<number>
  tags: Ref<ITag[]>
  clearSelection: () => void
  fetch: () => void
}

export function useNotesActions(opts: UseNotesActionsOptions) {
  const { items, selectedIds, realAllChecked, q, total, tags, clearSelection, fetch } = opts
  const mainStore = useMainStore()
  const dataType = DataType.NOTE

  const { addToTags } = useAddToTags(dataType, tags)

  const { mutate: exportNotes, onDone: onExported } = initMutation({
    document: exportNotesGQL,
  })

  onExported(async (r: any) => {
    const jsonStr = r.data.exportNotes
    const notes: INote[] = JSON.parse(jsonStr)
    const zip = new JSZip()
    for (const note of notes) {
      const safeName = (note.title || 'untitled').replace(/[/\\:*?"<>|]/g, '_').substring(0, 100)
      const fileName = `${safeName}.md`
      zip.file(fileName, note.content || '')
    }
    const blob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'notes.zip'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  })

  const { deleteItems } = useDelete(deleteNotesGQL, () => {
    clearSelection()
    fetch()
  })

  const { trashLoading, trash } = useNotesTrash(clearSelection, fetch)
  const { restoreLoading, restore } = useNotesRestore(clearSelection, fetch)

  function getQuery() {
    return realAllChecked.value ? q.value : `ids:${selectedIds.value.join(',')}`
  }

  function exportNotes2() {
    exportNotes({ query: getQuery() })
  }

  function deleteItem(item: INote) {
    openModal(DeleteConfirm, {
      id: item.id,
      name: truncateText(item.title, 20),
      gql: deleteNoteGQL,
      variables: () => ({ query: `ids:${item.id}` }),
      done: () => { items.value = items.value.filter((it) => it.id !== item.id); clearSelection(); total.value-- },
      typeName: 'Note',
    })
  }

  function addItemToTags(item: INote) {
    openModal(UpdateTagRelationsModal, {
      type: dataType,
      tags: tags.value,
      item: { key: item.id, title: '', size: 0 },
      selected: tags.value.filter((it) => item.tags.some((t) => t.id === it.id)),
    })
  }

  function viewUrl(item: INote) {
    const qVal = router.currentRoute.value.query.q
    return qVal ? `/notes/${item.id}?q=${qVal}` : `/notes/${item.id}`
  }

  function view(item: INote) {
    replacePath(mainStore, viewUrl(item))
  }

  function create() {
    router.push('/notes/create')
  }

  return {
    addToTags, deleteItems, deleteItem, addItemToTags,
    exportNotes2, getQuery, trashLoading, trash, restoreLoading, restore,
    view, viewUrl, create,
  }
}
