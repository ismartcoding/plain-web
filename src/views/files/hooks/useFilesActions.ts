import { ref, type Ref, type ComputedRef } from 'vue'
import type { IFile } from '@/lib/file'
import type { IFileFilter } from '@/lib/interfaces'
import { openModal } from '@/components/modal'
import DownloadMethodModal from '@/components/DownloadMethodModal.vue'
import DeleteFileConfirm from '@/components/DeleteFileConfirm.vue'
import EditValueModal from '@/components/EditValueModal.vue'
import { shortUUID } from '@/lib/strutil'
import { getFileUrlByPath } from '@/lib/api/file'
import { initMutation, setTempValueGQL, addFavoriteFolderGQL } from '@/lib/api/mutation'
import emitter from '@/plugins/eventbus'
import toast from '@/components/toaster'
import { arrayRemove } from '@/lib/array'

interface UseFilesActionsOptions {
  items: Ref<IFile[]>
  total: Ref<number>
  selectedIds: Ref<string[]>
  clearSelection: () => void
  filter: IFileFilter
  rootDir: ComputedRef<string>
  urlTokenKey: Ref<Uint8Array | null>
  t: (key: string, args?: any) => string
  fetch: () => void
  refetchMounts: () => void
  copy: (ids: string[]) => void
  cut: (ids: string[]) => void
  paste: (dir: string) => void
  downloadFile: (path: string) => void
  downloadDir: (path: string) => void
  downloadFiles: (key: string) => void
  createPath: Ref<string>
  createVariables: (value: string) => any
  createMutation: () => any
  renameItem: Ref<IFile | undefined>
  renameMutation: () => any
  renameVariables: (value: string) => any
  renameDone: (newName: string) => void
}

export function useFilesActions(opts: UseFilesActionsOptions) {
  const {
    items, total, selectedIds, clearSelection, filter, rootDir, urlTokenKey,
    t, fetch, refetchMounts, copy, cut, paste,
    downloadFile, downloadDir, downloadFiles,
    createPath, createVariables, createMutation,
    renameItem, renameMutation, renameVariables, renameDone,
  } = opts

  const { loading: downloadLoading, mutate: setTempValue, onDone: setTempValueDone } = initMutation({ document: setTempValueGQL })
  setTempValueDone((r: any) => { downloadFiles(r.data.setTempValue.key); clearSelection() })

  const { mutate: addFavoriteFolderMutation, onDone: addFavDone } = initMutation({
    document: addFavoriteFolderGQL,
  })
  addFavDone(() => emitter.emit('refetch_app'))

  const onDeleted = (files: IFile[]) => {
    files.forEach((f) => { arrayRemove(items.value, (it: IFile) => it.id === f.id) })
    total.value = items.value.length
    clearSelection()
    refetchMounts()
  }

  const downloadItems = () => {
    const selected = items.value.filter((it) => selectedIds.value.includes(it.id))
    if (selected.length === 0) { toast(t('select_first'), 'error'); return }
    if (selected.length === 1) {
      const item = selected[0]
      item.isDir ? downloadDir(item.path) : downloadFile(item.path)
      clearSelection()
      return
    }
    openModal(DownloadMethodModal, {
      onEach: async () => {
        for (const it of selected) {
          it.isDir ? downloadDir(it.path) : downloadFile(it.path)
          await new Promise((resolve) => setTimeout(resolve, 250))
        }
        clearSelection()
      },
      onZip: () => {
        setTempValue({ key: shortUUID(), value: JSON.stringify(selectedIds.value.map((p) => ({ path: p }))) })
      },
    })
  }

  const deleteItems = () => {
    openModal(DeleteFileConfirm, {
      files: items.value.filter((it) => selectedIds.value.includes(it.id)),
      onDone: onDeleted,
    })
  }

  const deleteItem = (item: IFile) => { openModal(DeleteFileConfirm, { files: [item], onDone: onDeleted }) }
  const copyItems = () => { copy(selectedIds.value); clearSelection() }
  const cutItems = () => { cut(selectedIds.value); clearSelection() }
  const pasteDir = () => { paste(filter.parent) }
  const duplicateItem = (item: IFile) => { copy([item.id]); paste(filter.parent) }
  const cutItem = (item: IFile) => { cut([item.id]) }
  const copyItem = (item: IFile) => { copy([item.id]) }
  const pasteItem = (item: IFile) => { paste(item.path) }

  const copyLinkItem = (item: IFile) => {
    const url = getFileUrlByPath(urlTokenKey.value, item.path)
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(() => toast(t('link_copied'))).catch(() => fallbackCopy(url))
    } else {
      fallbackCopy(url)
    }
  }
  function fallbackCopy(text: string) {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.cssText = 'position:fixed;left:-999999px;top:-999999px'
    document.body.appendChild(ta)
    ta.focus(); ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    toast(ok ? t('link_copied') : t('copy_failed'), ok ? undefined : 'error')
  }

  const renameItemClick = (item: IFile) => {
    renameItem.value = item
    openModal(EditValueModal, {
      title: t('rename'), placeholder: t('name'), value: item.name,
      mutation: renameMutation, getVariables: renameVariables, done: renameDone,
    })
  }

  const createDir = () => {
    createPath.value = filter.parent
    openModal(EditValueModal, {
      title: t('create_folder'), placeholder: t('name'),
      mutation: createMutation, getVariables: createVariables,
    })
  }

  const addToFavoritesClick = (item: IFile) => {
    if (!item.isDir) return
    addFavoriteFolderMutation({ rootPath: rootDir.value, fullPath: item.path })
      .then(() => toast(t('added')))
      .catch(() => toast(t('error'), 'error'))
  }

  return {
    downloadLoading, downloadItems, deleteItems, deleteItem,
    copyItems, cutItems, pasteDir, duplicateItem, cutItem, copyItem, pasteItem,
    copyLinkItem, renameItemClick, createDir, addToFavoritesClick, onDeleted,
  }
}
