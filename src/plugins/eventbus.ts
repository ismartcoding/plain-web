import type {
  IMediaItemDeletedEvent,
  IMediaItemsDeletedEvent,
  IItemTagsUpdatedEvent,
  IItemsTagsUpdatedEvent,
  IFileDeletedEvent,
} from '@/lib/interfaces'
import type { IUploadItem } from '@/stores/temp'
import mitt, { type Emitter } from 'mitt'

type Events = {
  upload_task_done: IUploadItem
  upload_task_created: boolean
  refetch_app: undefined
  play_audio: undefined
  do_play_audio: undefined
  pause_audio: undefined
  item_tags_updated: IItemTagsUpdatedEvent
  items_tags_updated: IItemsTagsUpdatedEvent
  refetch_tags: string
  media_item_deleted: IMediaItemDeletedEvent
  media_items_deleted: IMediaItemsDeletedEvent
  file_deleted: IFileDeletedEvent
  toast: string
  feeds_fetched: any
  ai_chat_replied: any
  screen_mirroring: string
  message_created: any
  message_updated: any
  message_deleted: any
  notification_created: any
  notification_updated: any
  notification_deleted: any
  color_mode_changed: undefined
  app_socket_connection_changed: boolean
}

const emitter: Emitter<Events> = mitt<Events>()

export default emitter
