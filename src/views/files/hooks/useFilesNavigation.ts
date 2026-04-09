import { type Ref, type ComputedRef } from 'vue'
import { type IFile, canOpenInBrowser, canView, isTextFile } from '@/lib/file'
import { getFileUrlByPath, getFileId } from '@/lib/api/file'
import type { IFileFilter } from '@/lib/interfaces'
import { useMainStore } from '@/stores/main'
import { replacePath } from '@/plugins/router'
import type { ISource } from '@/components/lightbox/types'

interface UseFilesNavigationOptions {
  filter: IFileFilter
  rootDir: ComputedRef<string>
  urlTokenKey: Ref<Uint8Array | null>
  buildQ: (filter: IFileFilter) => string
  clearSelection: () => void
  view: (items: IFile[], f: IFile) => void
  downloadFile: (path: string) => void
  items: Ref<IFile[]>
}

export function useFilesNavigation(opts: UseFilesNavigationOptions) {
  const { filter, rootDir, urlTokenKey, buildQ, clearSelection, view, downloadFile, items } = opts
  const mainStore = useMainStore()

  function getUrl(q: string) {
    return q ? `/files?q=${q}` : `/files`
  }

  function navigateToDir(dir: string) {
    clearSelection()
    filter.parent = dir
    filter.text = ''
    replacePath(mainStore, getUrl(buildQ(filter)))
  }

  function toggleShowHidden() {
    filter.showHidden = !filter.showHidden
    mainStore.fileShowHidden = filter.showHidden
    replacePath(mainStore, getUrl(buildQ(filter)))
  }

  function openFile(item: IFile) {
    if (isTextFile(item.name)) {
      const fileId = getFileId(urlTokenKey.value, item.path)
      window.open(`/text-file?id=${encodeURIComponent(fileId)}`, '_blank')
    } else if (canOpenInBrowser(item.name)) {
      window.open(getFileUrlByPath(urlTokenKey.value, item.path), '_blank')
    } else if (canView(item.name)) {
      view(items.value, item)
    } else {
      downloadFile(item.path)
    }
  }

  function clickItem(item: IFile) {
    if (item.isDir) { navigateToDir(item.path); return }
    openFile(item)
  }

  function viewItem(event: Event, item: IFile) {
    if (item.isDir) return
    event.stopPropagation()
    openFile(item)
  }

  return { navigateToDir, toggleShowHidden, clickItem, viewItem }
}
