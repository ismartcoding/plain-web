import type { IItemTagsUpdatedEvent, IItemsTagsUpdatedEvent, IFileDeletedEvent, IFileRenamedEvent, IMediaItemsActionedEvent, INotesActionedEvent } from '@/lib/interfaces'
import type { IUploadItem } from '@/stores/temp'
import mitt, { type Emitter } from 'mitt'
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
}

const emitter: Emitter<Events> = mitt<Events>()

export default emitter
