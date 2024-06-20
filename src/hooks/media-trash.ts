import { initMutation, trashMediaItemsGQL, restoreMediaItemsGQL } from '@/lib/api/mutation'
import type { DataType } from '@/lib/data'
import emitter from '@/plugins/eventbus'
import type { FetchResult } from '@apollo/client'
import { reactive } from 'vue'

export const useMediaTrash = (dataType: DataType, clearSelection: () => void, fetch: () => void) => {
  const { mutate, onDone: onTrashed } = initMutation({
    document: trashMediaItemsGQL,
    appApi: true,
  })

  const loading = reactive(new Map())

  onTrashed((r: FetchResult<any, Record<string, any>, Record<string, any>>) => {
    loading.delete(r.data.trashMediaItems)
    clearSelection()
    fetch()
    emitter.emit('refetch_tags', dataType)
    emitter.emit('media_items_actioned', { type: dataType, action: 'trash' })
  })

  return {
    trashLoading(query: string) {
      return loading.get(query) ?? false
    },
    trash(query: string) {
      loading.set(query, true)
      mutate({ query, type: dataType })
    },
  }
}

export const useMediaRestore = (dataType: DataType, clearSelection: () => void, fetch: () => void) => {
  const { mutate, onDone: onRestored } = initMutation({
    document: restoreMediaItemsGQL,
    appApi: true,
  })

  const loading = reactive(new Map())

  onRestored((r: FetchResult<any, Record<string, any>, Record<string, any>>) => {
    loading.delete(r.data.restoreMediaItems)
    clearSelection()
    fetch()
    emitter.emit('refetch_tags', dataType)
    emitter.emit('media_items_actioned', { type: dataType, action: 'restore' })
  })

  return {
    restoreLoading(query: string) {
      return loading.get(query) ?? false
    },
    restore(query: string) {
      loading.set(query, true)
      mutate({ query, type: dataType })
    },
  }
}
