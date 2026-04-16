import { ref, reactive, onMounted, onUnmounted, type ComputedRef, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { IChatItem } from '@/lib/interfaces'
import type { IUploadItem } from '@/stores/temp'
import { useChatFilesUpload } from '@/hooks/upload'
import { useTasks } from './chat'
import { normalizeChatItem } from './chat-events'
import { shortUUID } from '@/lib/strutil'
import { formatFileSize } from '@/lib/format'
import { getVideoData, getImageData, isVideo } from '@/lib/file'
import emitter from '@/plugins/eventbus'

export function useChatUpload(
  chatId: ComputedRef<string>,
  channelId: ComputedRef<string>,
  appDir: string,
  scrollBottom: () => void,
  chatText: Ref<string>,
  chatItems: Ref<IChatItem[]>,
) {
  const { t } = useI18n()
  const { getUploads } = useChatFilesUpload()
  const { enqueue: enqueueTask } = useTasks()

  const uploading = ref<IUploadItem[]>([])
  const messageUploads = reactive<Record<string, IUploadItem[]>>({})
  const uploadToMessage = new Map<string, string>()
  const sendingAgg = reactive<Record<string, { uploaded: number; speed: number }>>({})
  const downloadProgress = reactive<Record<string, { downloaded: number; total: number; speed: number; status: string }>>({})

  function sendingText(messageId: string) {
    const agg = sendingAgg[messageId]
    if (!agg) return t('sending') as unknown as string
    return `${t('sending')} ${formatFileSize(agg.uploaded)} (${formatFileSize(agg.speed)}/s)`
  }

  async function handleContentUpload(files: File[], contentType: string, options: { summary?: string } = {}) {
    const uploads = getUploads(appDir, files)
    uploads.forEach((u) => { u.status = 'pending'; u.isAppFile = true })

    const valueItems: any[] = []
    for (const upload of uploads) {
      const itemProps: any = {
        dir: appDir, uri: upload.fileName || upload.file.name,
        size: upload.file.size, duration: 0, width: 0, height: 0, summary: options.summary,
      }
      if (upload.file.type.startsWith('video') || isVideo(upload.file.name)) {
        const v = await getVideoData(upload.file)
        itemProps.duration = v.duration; itemProps.thumbnail = v.thumbnail; itemProps.width = v.width; itemProps.height = v.height
      } else if (upload.file.type.startsWith('image')) {
        const v = await getImageData(upload.file)
        itemProps.width = v.width; itemProps.height = v.height
      }
      valueItems.push(itemProps)
    }

    const _content = { type: contentType, value: { items: valueItems } }
    const item: IChatItem = {
      id: 'new_' + shortUUID(), fromId: 'me', toId: chatId.value, channelId: channelId.value,
      createdAt: new Date().toISOString(), 
      content: JSON.stringify(_content), 
      _content, 
      __typename: 'ChatItem',
      data: { ids: uploads.map((it) => URL.createObjectURL(it.file)) },
    }

    messageUploads[item.id] = uploads
    uploads.forEach((u) => uploadToMessage.set(u.id, item.id))
    sendingAgg[item.id] = {
      uploaded: uploads.reduce((s, u) => s + (u.uploadedSize || 0), 0),
      speed: uploads.reduce((s, u) => s + (u.uploadSpeed || 0), 0),
    }
    uploading.value = [...uploading.value, ...uploads]
    const tempId = item.id
    chatItems.value = [...chatItems.value, item]
    enqueueTask(item, uploads, chatId.value, (sentItem) => {
      const normalized = normalizeChatItem(sentItem)
      chatItems.value = chatItems.value.filter((i) => i.id !== tempId)
      if (!chatItems.value.some((i) => i.id === normalized.id)) {
        chatItems.value = [...chatItems.value, normalized]
      }
      scrollBottom()
    })
    scrollBottom()
  }

  async function doUploadFiles(files: File[]) {
    if (files.length) await handleContentUpload(files, 'files')
  }

  async function doUploadImages(files: File[]) {
    if (files.length) await handleContentUpload(files, 'images')
  }

  async function sendLongMessageAsFile(message: string) {
    const file = new File([message], `message-${Date.now()}.txt`, { type: 'text/plain' })
    const summaryText = message.substring(0, 250).trim()
    const summary = summaryText.lastIndexOf(' ') > 230
      ? summaryText.substring(0, summaryText.lastIndexOf(' ')) + '...'
      : summaryText + '...'
    await handleContentUpload([file], 'files', { summary })
    chatText.value = ''
  }

  // Event bus handlers
  const handlers: Record<string, (...args: any[]) => any> = {}

  onMounted(() => {
    handlers.upload_progress = (u: IUploadItem) => {
      const mid = uploadToMessage.get(u.id)
      if (!mid) return
      const list = messageUploads[mid]
      if (!list) return
      sendingAgg[mid] = {
        uploaded: list.reduce((s, it) => s + (it.uploadedSize || 0), 0),
        speed: list.reduce((s, it) => s + (it.uploadSpeed || 0), 0),
      }
    }
    emitter.on('upload_progress', handlers.upload_progress)

    handlers.download_progress = (items: any[]) => {
      const newProgress: Record<string, { downloaded: number; total: number; speed: number; status: string }> = {}
      for (const item of items) {
        const msgId = item.messageId
        if (!newProgress[msgId]) newProgress[msgId] = { downloaded: 0, total: 0, speed: 0, status: 'pending' }
        newProgress[msgId].downloaded += item.downloaded
        newProgress[msgId].total += item.total
        newProgress[msgId].speed += item.speed
        const s = item.status; const cur = newProgress[msgId].status
        if (s === 'downloading') newProgress[msgId].status = 'downloading'
        else if (s === 'paused' && cur !== 'downloading') newProgress[msgId].status = 'paused'
        else if (s === 'failed' && cur === 'pending') newProgress[msgId].status = 'failed'
      }
      Object.keys(downloadProgress).forEach((k) => delete downloadProgress[k])
      Object.assign(downloadProgress, newProgress)
    }
    emitter.on('download_progress', handlers.download_progress)
  })

  onUnmounted(() => {
    Object.entries(handlers).forEach(([event, fn]) => emitter.off(event as any, fn))
  })

  return { doUploadFiles, doUploadImages, sendLongMessageAsFile, sendingAgg, sendingText, downloadProgress }
}
