import type { IItemTagsUpdatedEvent, IItemsTagsUpdatedEvent, IFileDeletedEvent, IFileRenamedEvent, IMediaItemsActionedEvent, INotesActionedEvent } from '@/lib/interfaces'
import type { IUploadItem } from '@/stores/temp'
import type { SignalingMessage } from '@/lib/webrtc-client'

type Events = {
  upload_task_done: IUploadItem
  upload_progress: IUploadItem
  refetch_app: undefined
  play_audio: undefined
  do_play_audio: undefined
  pause_audio: undefined
  item_tags_updated: IItemTagsUpdatedEvent
  items_tags_updated: IItemsTagsUpdatedEvent
  refetch_tags: string
  media_items_actioned: IMediaItemsActionedEvent
  feed_entries_deleted: undefined
  calls_deleted: undefined
  notes_actioned: INotesActionedEvent
  file_deleted: IFileDeletedEvent
  file_renamed: IFileRenamedEvent
  toast: string
  tap_phone: string
  feeds_fetched: any
  message_created: any
  message_updated: any
  message_deleted: any
  message_cleared: string
  notification_created: any
  notification_updated: any
  notification_deleted: any
  notification_refreshed: any
  color_mode_changed: undefined
  app_socket_connection_changed: boolean
  pomodoro_action: any
  pomodoro_settings_update: any
  webrtc_signaling: SignalingMessage
  screen_mirroring: string
  screen_mirror_audio_granted: boolean
  bookmark_updated: any
  download_progress: any[]
  channels_updated: any[]
  sms_sent: undefined
  image_search_updated: any
}

type Handler<T = any> = (event: T) => void

function createEmitter<E extends Record<string, any>>() {
  const all = new Map<keyof E, Set<Handler>>()

  function on<K extends keyof E>(type: K, handler: Handler<E[K]>) {
    const s = all.get(type)
    if (s) s.add(handler)
    else all.set(type, new Set([handler]))
  }

  function off<K extends keyof E>(type: K, handler?: Handler<E[K]>) {
    if (handler) all.get(type)?.delete(handler)
    else all.delete(type)
  }

  function emit<K extends keyof E>(type: K, event: E[K]): void
  function emit<K extends keyof E>(type: undefined extends E[K] ? K : never): void
  function emit(type: any, event?: any) {
    all.get(type)?.forEach((h) => h(event))
  }

  return { on, off, emit }
}

const emitter = createEmitter<Events>()

export default emitter
