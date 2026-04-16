import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { getFileName, getFileUrl, notId, getFileExtension, getPeerProxyUrl, getFileId } from '@/lib/api/file'
import type { ISource } from '@/components/lightbox/types'
import { isVideo, isImage, isAudio, isTextFile, canOpenInBrowser, isAppFile } from '@/lib/file'
import { useTempStore } from '@/stores/temp'

export function useChatFiles(props: { data: any; downloadInfo: any; peer: { ip: string; port: number } | null }) {
  const tempStore = useTempStore()
  const { urlTokenKey } = storeToRefs(tempStore)

  const activeAudioSrc = ref<string | null>(null)
  const iconErrors = ref<string[]>([])

  const items = computed<ISource[]>(() => {
    const files = props.data?._content?.value?.items ?? []
    return (props.data?.data?.ids ?? []).map((id: string, i: number) => {
      const f = files[i]
      return {
        path: f.uri, src: getFileUrl(id),
        viewOriginImage: notId(id) || f.uri.endsWith('.gif'),
        name: getFileName(f.fileName ?? f.uri), duration: f.duration, size: f.size,
        fileId: id, thumbnail: f.thumbnail, extension: getFileExtension(f.uri),
        summary: f.summary || undefined, isFromChat: true,
      }
    })
  })

  const ACTIVE_STATUSES = ['pending', 'downloading', 'paused', 'failed']
  const isActiveDl = computed(() => !!props.downloadInfo && ACTIVE_STATUSES.includes(props.downloadInfo.status))

  function getThumb(item: ISource) {
    if (isImage(item.name) || isVideo(item.name)) {
      if (item.thumbnail) return item.thumbnail
      if (isActiveDl.value) {
        if (props.peer && item.path.startsWith('fsid:')) {
          return getPeerProxyUrl(tempStore.urlTokenKey, props.peer, item.path.slice(4), '&w=50&h=50')
        }
        return ''
      }
      return item.src.startsWith('blob:') ? item.src : `${item.src}&w=50&h=50`
    }
    const ext = item.extension
    if (ext && !iconErrors.value.includes(item.name)) return `/ficons/${ext}.svg`
    return '/ficons/default.svg'
  }

  function onIconError(name: string) {
    if (!iconErrors.value.includes(name)) iconErrors.value.push(name)
  }

  function clickItem(item: ISource) {
    if (isAudio(item.name)) {
      activeAudioSrc.value = activeAudioSrc.value === item.src ? null : item.src
      return
    }
    if (isTextFile(item.name) && item.fileId) {
      let textFileId = item.fileId
      if (isAppFile(item.path) && urlTokenKey.value) {
        textFileId = getFileId(urlTokenKey.value, JSON.stringify({ path: item.path, name: item.name }))
      }
      window.open(`/text-file?id=${encodeURIComponent(textFileId)}`, '_blank')
    } else if (canOpenInBrowser(item.name)) {
      window.open(item.src, '_blank')
    } else if (isImage(item.name) || isVideo(item.name)) {
      const viewable = items.value.filter((it) => isImage(it.name) || isVideo(it.name))
      tempStore.lightbox = { sources: viewable, index: viewable.findIndex((it) => it.src === item.src), visible: true }
    } else {
      window.open(item.src, '_blank')
    }
  }

  return { items, activeAudioSrc, getThumb, onIconError, clickItem }
}
