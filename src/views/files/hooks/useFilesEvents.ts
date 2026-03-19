import { onActivated, onDeactivated, watch, type Ref } from 'vue'
import emitter from '@/plugins/eventbus'
import type { IUploadItem } from '@/stores/temp'
import type { IFile } from '@/lib/file'
import type { IFileDeletedEvent, IFileRenamedEvent } from '@/lib/interfaces'

interface UseFilesEventsOptions {
  isActive: Ref<boolean>
  fileSortBy: Ref<string>
  routeFullPath: () => string
  applyRouteQuery: () => void
  fetch: () => void
  refetchMounts: () => void
  refreshing: Ref<boolean>
  sorting: Ref<boolean>
  onDeleted: (files: IFile[]) => void
  pageKeyDown: (e: KeyboardEvent) => void
  pageKeyUp: (e: KeyboardEvent) => void
}

export function useFilesEvents(opts: UseFilesEventsOptions) {
  const {
    isActive, fileSortBy, routeFullPath, applyRouteQuery, fetch, refetchMounts,
    refreshing, sorting, onDeleted, pageKeyDown, pageKeyUp,
  } = opts

  const uploadTaskDoneHandler = (r: IUploadItem) => {
    if (r.status === 'done') {
      setTimeout(() => { fetch(); refetchMounts() }, 1000)
    }
  }

  const fileDeletedHandler = (event: IFileDeletedEvent) => { onDeleted([event.item]) }
  const fileRenamedHandler = (_: IFileRenamedEvent) => { fetch() }

  watch(routeFullPath, () => {
    if (!isActive.value) return
    applyRouteQuery()
    fetch()
  })

  watch(fileSortBy, () => {
    sorting.value = true
    fetch()
  })

  onActivated(() => {
    isActive.value = true
    applyRouteQuery()
    fetch()
    emitter.on('upload_task_done', uploadTaskDoneHandler)
    emitter.on('file_deleted', fileDeletedHandler)
    emitter.on('file_renamed', fileRenamedHandler)
    window.addEventListener('keydown', pageKeyDown)
    window.addEventListener('keyup', pageKeyUp)
  })

  onDeactivated(() => {
    isActive.value = false
    emitter.off('upload_task_done', uploadTaskDoneHandler)
    emitter.off('file_deleted', fileDeletedHandler)
    emitter.off('file_renamed', fileRenamedHandler)
    window.removeEventListener('keydown', pageKeyDown)
    window.removeEventListener('keyup', pageKeyUp)
  })
}
