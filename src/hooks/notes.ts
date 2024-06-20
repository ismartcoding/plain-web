import { initMutation, restoreNotesGQL, trashNotesGQL } from '@/lib/api/mutation'
import { DataType } from '@/lib/data'
import emitter from '@/plugins/eventbus'
import type { FetchResult } from '@apollo/client'
import { reactive } from 'vue'

export const useNotesTrash = (clearSelection: () => void, fetch: () => void) => {
  const { mutate, onDone: onTrashed } = initMutation({
    document: trashNotesGQL,
    appApi: true,
  })

  const loading = reactive(new Map())

  onTrashed((r: FetchResult<any, Record<string, any>, Record<string, any>>) => {
    loading.delete(r.data.trashNotes)
    clearSelection()
    fetch()
    emitter.emit('refetch_tags', DataType.NOTE)
    emitter.emit('notes_actioned', { action: 'trash' })
  })

  return {
    trashLoading(query: string) {
      return loading.get(query) ?? false
    },
    trash(query: string) {
      loading.set(query, true)
      mutate({ query })
    },
  }
}

export const useNotesRestore = (clearSelection: () => void, fetch: () => void) => {
  const { mutate, onDone: onRestored } = initMutation({
    document: restoreNotesGQL,
    appApi: true,
  })

  const loading = reactive(new Map())

  onRestored((r: FetchResult<any, Record<string, any>, Record<string, any>>) => {
    loading.delete(r.data.restoreNotes)
    clearSelection()
    fetch()
    emitter.emit('refetch_tags', DataType.NOTE)
    emitter.emit('notes_actioned', { action: 'restore' })
  })

  return {
    restoreLoading(query: string) {
      return loading.get(query) ?? false
    },
    restore(query: string) {
      loading.set(query, true)
      mutate({ query })
    },
  }
}
