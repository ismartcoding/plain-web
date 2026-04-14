import { computed, ref, reactive, watch, onMounted, onBeforeUnmount, type Ref } from 'vue'
import { on, off, isArray } from '@/components/lightbox/utils/index'
import { useImage, useMouse, useTouch } from '@/components/lightbox/utils/hooks'
import type { ISource, IImgWrapperState, IndexChangeActions } from '@/components/lightbox/types'
import { isVideo, isImage, isAudio, isSvg, isHeic } from '@/lib/file'
import { getFileUrlByPath } from '@/lib/api/file'
import { useTempStore } from '@/stores/temp'
import { storeToRefs } from 'pinia'
import { useMainStore } from '@/stores/main'
import { fileInfoGQL, initLazyQuery, tagsGQL } from '@/lib/api/query'
import { openModal } from '@/components/modal'
import { useI18n } from 'vue-i18n'
import UpdateTagRelationsModal from '@/components/UpdateTagRelationsModal.vue'
import type { IItemTagsUpdatedEvent, IFileDeletedEvent, IFileRenamedEvent, ITag, IMediaItemsActionedEvent } from '@/lib/interfaces'
import emitter from '@/plugins/eventbus'
import { useDownload, useRename } from '@/hooks/files'
import { getFileName } from '@/lib/api/file'
import { useDeleteItems } from '@/hooks/media'
import { DataType } from '@/lib/data'
import { arrayRemove } from '@/lib/array'
import DeleteFileConfirm from '@/components/DeleteFileConfirm.vue'
import EditValueModal from '@/components/EditValueModal.vue'

export function useLightboxState(isPhone: boolean) {
  const tempStore = useTempStore()
  const { urlTokenKey, app } = storeToRefs(tempStore)
  const { lightboxInfoVisible } = storeToRefs(useMainStore())

  const { imgRef, imgState, setImgSize } = useImage()
  const imgIndex = ref(0)
  const current = ref<ISource>()
  const fileInfo = ref<any>(null)
  const video = ref<HTMLVideoElement>()

  const imgWrapperState = reactive<IImgWrapperState>({
    scale: 1,
    lastScale: 1,
    rotateDeg: 0,
    top: 0,
    left: 0,
    initX: 0,
    initY: 0,
    lastX: 0,
    lastY: 0,
    touches: [] as TouchList | [],
  })

  const status = reactive({
    loadError: false,
    loading: false,
    dragging: false,
    gesturing: false,
    swipeToLeft: false,
    swipeToRight: false,
    wheeling: false,
  })

  const imgWrapperStyle = computed(() => {
    const mobileOffset = isPhone ? -28 : 0
    return {
      cursor: status.loadError ? 'default' : 'move',
      top: `calc(50% + ${imgWrapperState.top + mobileOffset}px)`,
      left: `calc(50% + ${imgWrapperState.left}px)`,
      transition: status.dragging || status.gesturing ? 'none' : '',
      transform: `translate(-50%, -50%) scale(${imgWrapperState.scale}) rotate(${imgWrapperState.rotateDeg}deg)`,
    }
  })

  return {
    tempStore,
    urlTokenKey,
    app,
    lightboxInfoVisible,
    imgRef,
    imgState,
    setImgSize,
    imgIndex,
    current,
    fileInfo,
    video,
    imgWrapperState,
    status,
    imgWrapperStyle,
  }
}

export function useLightboxQueries(
  current: Ref<ISource | undefined>,
  fileInfo: Ref<any>,
  imgState: { naturalWidth: number; naturalHeight: number },
) {
  function updateViewOriginImageState() {
    if (current.value && fileInfo.value && isImage(current.value.name) && current.value.path === fileInfo.value.path) {
      if (isSvg(current.value.name)) {
        current.value.viewOriginImage = true
      } else if (isHeic(current.value.name)) {
        // HEIC files must always go through server-side conversion; raw HEIC is not displayable in most browsers
      } else {
        const { width, height } = fileInfo.value.data
        if (width === imgState.naturalWidth && height === imgState.naturalHeight) {
          current.value.viewOriginImage = true
        }
      }
    }
  }

  const {
    fetch: loadInfo,
  } = initLazyQuery({
    handle: (data: any, error: string) => {
      if (!error && data) {
        fileInfo.value = data.fileInfo
        updateViewOriginImageState()
      }
    },
    document: fileInfoGQL,
    variables: () => ({
      id: current.value?.data?.id ?? '',
      path: current.value?.path ?? '',
      fileName: current.value?.name,
    }),
  })

  const tagsMap = new Map<string, ITag[]>()
  const { fetch: loadTags } = initLazyQuery({
    handle: (data: any, _error: string) => {
      if (data) {
        tagsMap.set(current.value?.type ?? '', data.tags)
      }
    },
    document: tagsGQL,
    variables: () => ({
      type: current.value?.type ?? '',
    }),
  })

  return { loadInfo, refetchInfo: loadInfo, updateViewOriginImageState, tagsMap, loadTags }
}

export function useLightboxTransform(
  imgWrapperState: IImgWrapperState,
  imgState: { maxScale: number },
  status: { loadError: boolean; loading: boolean; dragging: boolean; gesturing: boolean; wheeling: boolean },
) {
  const defaultScale = 1.5

  const zoom = (newScale: number) => {
    if (Math.abs(1 - newScale) < 0.05) newScale = 1
    else if (Math.abs(imgState.maxScale - newScale) < 0.05) newScale = imgState.maxScale
    imgWrapperState.lastScale = imgWrapperState.scale
    imgWrapperState.scale = newScale
  }

  const zoomIn = () => {
    const s = imgWrapperState.scale * defaultScale
    if (s < imgState.maxScale * 100) zoom(s)
  }

  const zoomOut = () => {
    const s = imgWrapperState.scale / defaultScale
    if (s > 0.1) zoom(s)
  }

  const rotateLeft = () => { imgWrapperState.rotateDeg -= 90 }
  const rotateRight = () => { imgWrapperState.rotateDeg += 90 }

  const resize = () => {
    imgWrapperState.scale = 1
    imgWrapperState.top = 0
    imgWrapperState.left = 0
  }

  const onDblclick = () => {
    if (imgWrapperState.scale !== imgState.maxScale) {
      imgWrapperState.lastScale = imgWrapperState.scale
      imgWrapperState.scale = imgState.maxScale
    } else {
      imgWrapperState.scale = imgWrapperState.lastScale
    }
  }

  const onWheel = (e: WheelEvent) => {
    if (status.loadError || status.gesturing || status.loading || status.dragging || status.wheeling) return
    status.wheeling = true
    setTimeout(() => { status.wheeling = false }, 80)
    if (e.deltaY < 0) zoomIn()
    else zoomOut()
  }

  return { zoomIn, zoomOut, rotateLeft, rotateRight, resize, onDblclick, onWheel }
}

export function useLightboxNavigation(
  tempStore: ReturnType<typeof useTempStore>,
  imgIndex: Ref<number>,
  current: Ref<ISource | undefined>,
  imgWrapperState: IImgWrapperState,
  status: { loadError: boolean; loading: boolean; dragging: boolean; gesturing: boolean },
  tagsMap: Map<string, ITag[]>,
  loadTags: () => void,
  loadInfo: () => void,
  loop: Ref<boolean>,
  emit: (event: string, ...args: any[]) => void,
) {
  const reset = () => {
    imgWrapperState.scale = 1
    imgWrapperState.lastScale = 1
    imgWrapperState.rotateDeg = 0
    imgWrapperState.top = 0
    imgWrapperState.left = 0
    status.loadError = false
    status.dragging = false
    status.gesturing = false
    status.loading = true
  }

  const closeDialog = () => {
    tempStore.lightbox.visible = false
    tempStore.lightbox.index = -1
    imgIndex.value = 0
  }

  const changeIndex = async (newIndex: number, actions?: IndexChangeActions) => {
    const oldIndex = imgIndex.value
    reset()

    const s = tempStore.lightbox.sources[newIndex]
    if (!s.src) {
      s.src = getFileUrlByPath(tempStore.urlTokenKey, s.path)
    }

    imgIndex.value = newIndex
    current.value = tempStore.lightbox.sources[imgIndex.value]
    setTimeout(() => {
      const type = current.value?.type ?? ''
      if (type && !tagsMap.has(type)) loadTags()
      loadInfo()
    }, 0)

    if (oldIndex === newIndex) return

    if (actions) {
      if (isArray(actions)) {
        actions.forEach((action) => emit(action, oldIndex, newIndex))
      } else {
        emit(actions, oldIndex, newIndex)
      }
    }
    emit('on-index-change', oldIndex, newIndex)
  }

  const onNext = () => {
    const oldIndex = imgIndex.value
    const newIndex = loop.value ? (oldIndex + 1) % tempStore.lightbox.sources.length : oldIndex + 1
    if (!loop.value && newIndex > tempStore.lightbox.sources.length - 1) return
    changeIndex(newIndex, ['on-next', 'on-next-click'])
  }

  const onPrev = () => {
    const oldIndex = imgIndex.value
    let newIndex = oldIndex - 1
    if (oldIndex === 0) {
      if (!loop.value) return
      newIndex = tempStore.lightbox.sources.length - 1
    }
    changeIndex(newIndex, ['on-prev', 'on-prev-click'])
  }

  return { reset, closeDialog, changeIndex, onNext, onPrev }
}

export function useLightboxFileActions(
  current: Ref<ISource | undefined>,
  fileInfo: Ref<any>,
  tagsMap: Map<string, ITag[]>,
  urlTokenKey: Ref<Uint8Array | null>,
  refetchInfo: () => void,
  isPhone: boolean,
  lightboxInfoVisible: Ref<boolean>,
) {
  const { t } = useI18n()
  const { downloadFile } = useDownload(urlTokenKey)
  const { deleteItem } = useDeleteItems()
  const { renameItem, renameDone, renameMutation, renameVariables } = useRename(() => {
    refetchInfo()
  })

  function deleteFile() {
    const mediaTypes = [DataType.VIDEO, DataType.AUDIO, DataType.IMAGE]
    const type = current.value?.type
    const item = current.value?.data
    if (type && mediaTypes.includes(type)) {
      deleteItem(type, item)
    } else {
      openModal(DeleteFileConfirm, {
        files: [item],
        onDone: () => {
          emitter.emit('file_deleted', { item })
        },
      })
    }
  }

  function renameFile() {
    const item = current.value?.data
    if (!item || !current.value?.path) return

    renameItem.value = {
      id: item.id,
      path: current.value.path,
      name: getFileName(current.value.path),
      size: current.value.size || 0,
      isDir: false,
      extension: '',
      fileId: '',
      updatedAt: '',
      createdAt: '',
    }

    openModal(EditValueModal, {
      title: t('rename'),
      placeholder: t('name'),
      value: getFileName(current.value.path),
      mutation: renameMutation,
      getVariables: renameVariables,
      done: (newName: string) => {
        renameDone(newName)
        if (current.value) {
          const oldPath = current.value.path
          const newPath = oldPath.substring(0, oldPath.lastIndexOf('/') + 1) + newName
          emitter.emit('file_renamed', { oldPath, newPath, item: { ...current.value.data, path: newPath, name: newName } })
          current.value.path = newPath
          current.value.name = newName
        }
      },
    })
  }

  function addToTags() {
    const type = current.value?.type ?? ''
    const tags = tagsMap.get(type) ?? []
    const item = current.value?.data ?? {}
    openModal(UpdateTagRelationsModal, {
      type,
      tags,
      item: { key: item.id, title: item.title, size: item.size },
      selected: tags.filter((it: ITag) => fileInfo.value?.tags.some((t: ITag) => t.id === it.id)),
    })
  }

  function handleActionSuccess(action: string) {
    if (isPhone && (action === 'trash' || action === 'restore')) {
      lightboxInfoVisible.value = false
    }
  }

  const viewOrigin = () => {
    if (current.value) current.value.viewOriginImage = true
    // status.loading is set externally
  }

  return { downloadFile, deleteFile, renameFile, addToTags, handleActionSuccess, viewOrigin }
}

export function useLightboxEvents(
  tempStore: ReturnType<typeof useTempStore>,
  current: Ref<ISource | undefined>,
  video: Ref<HTMLVideoElement | undefined>,
  status: { loading: boolean; loadError: boolean },
  imgState: { maxScale: number },
  imgIndex: Ref<number>,
  setImgSize: () => void,
  refetchInfo: () => void,
  updateViewOriginImageState: () => void,
  closeDialog: () => void,
  onNext: () => void,
  onPrev: () => void,
  changeIndex: (i: number) => void,
  emit: (event: string, ...args: any[]) => void,
) {
  let isVideoPlaying = true

  const onLoad = () => {
    status.loading = false
    if (current.value && isImage(current.value.name)) {
      setImgSize()
      updateViewOriginImageState()
    }
  }

  const onError = (e: Event) => {
    status.loading = false
    status.loadError = true
    emit('on-error', e)
  }

  const onPlaying = () => { isVideoPlaying = true; video.value?.blur() }
  const onPause = () => { isVideoPlaying = false; video.value?.blur() }
  const onVolumeChange = () => { video.value?.blur() }

  const onKeyPress = (e: Event) => {
    if (!tempStore.lightbox.visible) return
    const evt = e as KeyboardEvent
    if (evt.key === 'Escape') {
      if (document.querySelector('.vue-modal')) return
      evt.stopPropagation()
      closeDialog()
    } else if (evt.key === 'ArrowLeft') {
      evt.stopPropagation()
      onPrev()
    } else if (evt.key === 'ArrowRight') {
      evt.stopPropagation()
      onNext()
    } else if (evt.key === ' ') {
      const v = video.value
      if (v) {
        if (v.paused && !isVideoPlaying) v.play()
        else v.pause()
      }
    }
  }

  const onWindowResize = () => { setImgSize() }

  // Event bus handlers
  const itemTagsUpdatedHandler = (event: IItemTagsUpdatedEvent) => {
    if (event.item.key === current.value?.data?.id) refetchInfo()
  }

  const navigateAfterRemove = () => {
    if (tempStore.lightbox.sources.length === 0) {
      closeDialog()
    } else {
      const newIndex = Math.min(imgIndex.value, tempStore.lightbox.sources.length - 1)
      changeIndex(newIndex)
    }
  }

  const mediaItemsActionedHandler = (event: IMediaItemsActionedEvent) => {
    const query = `ids:${current.value?.data?.id}`
    if (['delete', 'trash', 'restore'].includes(event.action) && event.query === query) {
      arrayRemove(tempStore.lightbox.sources, (it: ISource) => `ids:${it.data?.id}` === event.query)
      navigateAfterRemove()
    }
  }

  const fileDeletedHandler = (event: IFileDeletedEvent) => {
    if (event.item.path === current.value?.data?.path) {
      arrayRemove(tempStore.lightbox.sources, (it: ISource) => it.path === event.item.path)
      navigateAfterRemove()
    }
  }

  const fileRenamedHandler = (event: IFileRenamedEvent) => {
    tempStore.lightbox.sources.forEach((source: ISource) => {
      if (source.path === event.oldPath) {
        source.path = event.newPath
        source.name = getFileName(event.newPath)
        if (source.data) {
          source.data.path = event.newPath
          source.data.name = getFileName(event.newPath)
        }
      }
    })
    if (current.value && current.value.path === event.oldPath) {
      current.value.path = event.newPath
      current.value.name = getFileName(event.newPath)
      if (current.value.data) {
        current.value.data.path = event.newPath
        current.value.data.name = getFileName(event.newPath)
      }
    }
  }

  // Watchers
  watch(
    () => tempStore.lightbox.index,
    (newIndex) => {
      if (newIndex < 0 || newIndex >= tempStore.lightbox.sources.length) return
      changeIndex(newIndex)
    },
  )

  // Lifecycle
  onMounted(() => {
    on(window, 'keydown', onKeyPress)
    on(window, 'resize', onWindowResize)
    emitter.on('item_tags_updated', itemTagsUpdatedHandler)
    emitter.on('media_items_actioned', mediaItemsActionedHandler)
    emitter.on('file_deleted', fileDeletedHandler)
    emitter.on('file_renamed', fileRenamedHandler)
  })

  onBeforeUnmount(() => {
    off(window, 'keydown', onKeyPress)
    off(window, 'resize', onWindowResize)
    emitter.off('item_tags_updated', itemTagsUpdatedHandler)
    emitter.off('media_items_actioned', mediaItemsActionedHandler)
    emitter.off('file_deleted', fileDeletedHandler)
    emitter.off('file_renamed', fileRenamedHandler)
  })

  return { onLoad, onError, onPlaying, onPause, onVolumeChange }
}

export function useLightboxMouseTouch(
  imgWrapperState: IImgWrapperState,
  imgState: { width: number; height: number; naturalWidth: number; naturalHeight: number; maxScale: number },
  status: { loadError: boolean; loading: boolean; dragging: boolean; gesturing: boolean; swipeToLeft: boolean; swipeToRight: boolean },
) {
  const canMove = (button?: number) => button === 0
  const { onMouseDown, onMouseMove, onMouseUp } = useMouse(imgWrapperState, status, canMove)
  const { onTouchStart, onTouchMove, onTouchEnd } = useTouch(imgState, imgWrapperState, status, canMove)
  return { onMouseDown, onMouseMove, onMouseUp, onTouchStart, onTouchMove, onTouchEnd }
}
