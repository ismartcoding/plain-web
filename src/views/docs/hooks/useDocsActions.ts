import { type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { IDoc } from '@/lib/interfaces'
import type { IFile } from '@/lib/file'
import { isTextFile, canOpenInBrowser } from '@/lib/file'
import { openModal } from '@/components/modal'
import EditValueModal from '@/components/EditValueModal.vue'
import DeleteFileConfirm from '@/components/DeleteFileConfirm.vue'
import { initMutation, renameFileGQL, copyFileGQL } from '@/lib/api/mutation'
import { useDownload } from '@/hooks/files'
import { getFileUrlByPath, getFileId } from '@/lib/api/file'
import { arrayRemove } from '@/lib/array'

export function useDocsActions(
  items: Ref<IDoc[]>,
  selectedIds: Ref<string[]>,
  clearSelection: () => void,
  fetch: () => void,
  urlTokenKey: Ref<Uint8Array | null>,
) {
  const { t } = useI18n()
  const { downloadFile } = useDownload(urlTokenKey)

  const { mutate: copyMutate, onDone: copyDone } = initMutation({ document: copyFileGQL })
  copyDone(() => fetch())

  function openFile(item: IDoc) {
    if (isTextFile(item.name)) {
      const fileId = getFileId(urlTokenKey.value, item.path)
      window.open(`/text-file?id=${encodeURIComponent(fileId)}`, '_blank')
    } else if (canOpenInBrowser(item.name)) {
      const url = getFileUrlByPath(urlTokenKey.value, item.path)
      if (url) window.open(url, '_blank')
    } else {
      downloadFile(item.path, item.name)
    }
  }

  function deleteItem(item: IDoc) {
    openModal(DeleteFileConfirm, {
      files: [{ path: item.path, name: item.name }] as unknown as IFile[],
      onDone: () => { arrayRemove(items.value, (it: IDoc) => it.id === item.id) },
    })
  }

  function deleteSelected() {
    const docs = items.value.filter((it) => selectedIds.value.includes(it.id))
    if (docs.length === 0) return
    openModal(DeleteFileConfirm, {
      files: docs.map((it) => ({ path: it.path, name: it.name })) as unknown as IFile[],
      onDone: () => { clearSelection(); fetch() },
    })
  }

  function renameItem(item: IDoc) {
    openModal(EditValueModal, {
      title: t('rename'),
      value: item.name,
      mutation: () => initMutation({ document: renameFileGQL }),
      getVariables: (name: string) => ({ path: item.path, name }),
      done: () => fetch(),
    })
  }

  function duplicateItem(item: IDoc) {
    const dir = item.path.substring(0, item.path.lastIndexOf('/'))
    const ext = item.name.includes('.') ? '.' + item.name.split('.').pop()! : ''
    const base = item.name.slice(0, item.name.length - ext.length)
    copyMutate({ src: item.path, dst: `${dir}/${base}_copy${ext}`, overwrite: false })
  }

  function downloadSelected() {
    items.value
      .filter((it) => selectedIds.value.includes(it.id))
      .forEach((it) => downloadFile(it.path, it.name))
  }

  return { downloadFile, openFile, deleteItem, deleteSelected, renameItem, duplicateItem, downloadSelected }
}
