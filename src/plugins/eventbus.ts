import type { IUploadItem } from '@/stores/temp'
import mitt, { type Emitter } from 'mitt'

type Events = {
  upload_task_done: IUploadItem
  upload_task_created: boolean
  refetch_app: undefined
  play_audio: undefined
  refetch_by_tag_type: string
  toast: string
  feeds_fetched: any
  ai_chat_replied: any
  screen_mirrorring: string
}

const emitter: Emitter<Events> = mitt<Events>()

export default emitter
