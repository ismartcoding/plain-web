<template>
  <Teleport to="body">
    <transition v-if="tempStore.lightbox.visible">
      <div @touchmove="preventDefault" class="lightbox" @wheel="onWheel">
        <transition mode="out-in">
          <div class="layout">
            <header class="toolbar" v-if="current">
              <div v-if="current.name" class="source-name v-center">
                <button class="icon-button" @click="closeDialog" v-tooltip="$t('close')">
                  <md-ripple />
                  <i-material-symbols:close-rounded />
                </button>
                <span>{{ current.name }}</span>
              </div>

              <template v-if="isImage(current.name)">
                <button class="icon-button" v-if="!current.viewOriginImage" @click="viewOrigin" v-tooltip="$t('view_origin_image')">
                  <md-ripple />
                  <i-material-symbols:image-outline-rounded />
                </button>

                <button class="icon-button" @click="zoomIn" v-tooltip="$t('zoom_in')">
                  <md-ripple />
                  <i-material-symbols:zoom-in-rounded />
                </button>

                <button class="icon-button" @click="zoomOut" v-tooltip="$t('zoom_out')">
                  <md-ripple />
                  <i-material-symbols:zoom-out-rounded />
                </button>

                <button class="icon-button" @click="resize" v-tooltip="$t('resize')">
                  <md-ripple />
                  <i-material-symbols:aspect-ratio-outline-rounded />
                </button>

                <button class="icon-button" @click="rotateLeft" v-tooltip="$t('rotate_left')">
                  <md-ripple />
                  <i-material-symbols:rotate-left-rounded />
                </button>

                <button class="icon-button" @click="rotateRight" v-tooltip="$t('rotate_right')">
                  <md-ripple />
                  <i-material-symbols:rotate-right-rounded />
                </button>
              </template>
              <button class="icon-button" @click="lightboxInfoVisible = !lightboxInfoVisible" v-tooltip="$t('info')">
                <md-ripple />
                <i-material-symbols:info-outline-rounded />
              </button>
            </header>
            <section class="content" @click.self="closeDialog">
              <div v-if="tempStore.lightbox.sources.length > 1 && (loop || imgIndex > 0)" class="btn-prev" @click="onPrev">
                <i-material-symbols:chevron-left-rounded />
              </div>
              <div v-if="tempStore.lightbox.sources.length > 1 && (loop || imgIndex < tempStore.lightbox.sources.length - 1)" class="btn-next" @click="onNext">
                <i-material-symbols:chevron-right-rounded />
              </div>
              <div v-if="status.loading" class="loading">
                <md-circular-progress indeterminate />
              </div>
              <div v-else-if="status.loadError" class="v-on-error">
                {{ $t('load_failed', { name: current?.name }) }}
              </div>
              <div v-if="current && isVideo(current.name)" v-show="!status.loading && !status.loadError" class="v-video-wrapper" @click.self="closeDialog">
                <video ref="video" controls autoplay="true" :src="current.src" @error="onError" @canplay="onLoad" @playing="onPlaying" @pause="onPause" />
              </div>
              <div v-else-if="current && isAudio(current.name)" v-show="!status.loading && !status.loadError" class="v-audio-wrapper" @click.self="closeDialog">
                <div style="padding: 50px">
                  <audio controls autoplay="true" :src="current.src" @error="onError" @canplay="onLoad" />
                </div>
              </div>
              <div v-else-if="current && isImage(current.name)" v-show="!status.loading && !status.loadError" class="v-img-wrapper" :style="imgWrapperStyle">
                <img
                  ref="imgRef"
                  draggable="false"
                  class="v-img"
                  :style="isSvg(current.name) ? 'min-width: ' + imgState.width + 'px;' : ''"
                  :src="current?.src + (current?.viewOriginImage ? '' : '&w=1024&h=1024&cc=false')"
                  @mousedown="onMouseDown"
                  @mouseup="onMouseUp"
                  @mousemove="onMouseMove"
                  @touchstart="onTouchStart"
                  @touchmove="onTouchMove"
                  @touchend="onTouchEnd"
                  @load="onLoad"
                  @error="onError"
                  @dblclick="onDblclick"
                  @dragstart="
                    (e) => {
                      e.preventDefault()
                    }
                  "
                />
              </div>
            </section>
            <section class="info" v-if="lightboxInfoVisible">
              <div class="top-app-bar">
                <field-id :id="$t('info')" :raw="fileInfo" />
                <div class="actions">
                  <button class="icon-button" @click.stop="deleteFile" v-tooltip="$t('delete')" v-if="current?.data">
                    <md-ripple />
                    <i-material-symbols:delete-forever-outline-rounded />
                  </button>
                  <button class="icon-button" @click.stop="downloadFile(current?.path ?? '', getFileName(current?.path ?? '').replace(' ', '-'))" v-tooltip="$t('download')">
                    <md-ripple />
                    <i-material-symbols:download-rounded />
                  </button>
                </div>
              </div>
              <section class="list-items">
                <div class="item">
                  <div class="title">{{ $t('file_size') }}</div>
                  <div class="subtitle">
                    {{ formatFileSize(current?.size ?? 0) }}
                    <span v-if="fileInfo?.data?.width && fileInfo?.data?.height">{{ getResolution() }}</span>
                  </div>
                </div>
                <div class="item" v-if="fileInfo?.updatedAt">
                  <div class="title">{{ $t('updated_at') }}</div>
                  <div class="subtitle">
                    <span v-tooltip="formatDateTimeFull(fileInfo.updatedAt)">{{ formatDateTime(fileInfo.updatedAt) }}</span>
                  </div>
                </div>
                <div class="item" v-if="current && (isAudio(current?.name) || isVideo(current?.name))">
                  <div class="title">{{ $t('duration') }}</div>
                  <div class="subtitle">{{ formatSeconds(fileInfo?.data?.duration ?? current?.duration) }}</div>
                </div>
                <div class="item" v-if="current?.type">
                  <div class="title">
                    {{ $t('tags') }}
                    <button class="icon-button" v-tooltip="$t('add_to_tags')" @click.prevent="addToTags">
                      <md-ripple />
                      <i-material-symbols:label-outline-rounded />
                    </button>
                  </div>
                  <div class="subtitle"><item-tags :tags="fileInfo?.tags" /></div>
                </div>
                <div class="item" v-if="current?.path">
                  <div class="title">{{ $t('path') }}</div>
                  <div class="subtitle">{{ getFinalPath(app.externalFilesDir, current?.path) }}</div>
                </div>
              </section>
            </section>
          </div>
        </transition>
      </div>
    </transition>
  </Teleport>
</template>
<script setup lang="ts">
import { computed, ref, reactive, watch, onMounted, onBeforeUnmount } from 'vue'

import { on, off, isArray, preventDefault } from './utils/index'
import { useImage, useMouse, useTouch } from './utils/hooks'
import type { ISource, IImgWrapperState, IndexChangeActions } from './types'
import { isVideo, isImage, isAudio, isSvg } from '@/lib/file'
import { getFileUrlByPath } from '@/lib/api/file'
import { useTempStore } from '@/stores/temp'
import { storeToRefs } from 'pinia'
import { formatFileSize, formatSeconds } from '@/lib/format'
import { useMainStore } from '@/stores/main'
import { fileInfoGQL, initLazyQuery, tagsGQL } from '@/lib/api/query'
import { formatDateTime, formatDateTimeFull } from '@/lib/format'
import { openModal } from '@/components/modal'
import UpdateTagRelationsModal from '@/components/UpdateTagRelationsModal.vue'
import type { IItemTagsUpdatedEvent, IMediaItemDeletedEvent, IFileDeletedEvent, ITag } from '@/lib/interfaces'
import emitter from '@/plugins/eventbus'
import { useDownload } from '@/hooks/files'
import { getFileName, getFinalPath } from '@/lib/api/file'
import { useDeleteItems } from '@/hooks/media'
import { remove } from 'lodash-es'
import { DataType } from '@/lib/data'
import DeleteFileConfirm from '@/components/DeleteFileConfirm.vue'

const props = defineProps({
  loop: {
    type: Boolean,
    default: true,
  },
})

const emit = defineEmits(['on-error', 'on-prev', 'on-next', 'on-prev-click', 'on-next-click', 'on-index-change'])

const viewOrigin = () => {
  const c = current.value
  if (c) {
    c.viewOriginImage = true
  }
  status.loading = true
}
const tempStore = useTempStore()
const { urlTokenKey, app } = storeToRefs(tempStore)
const video = ref<HTMLVideoElement>()
const { imgRef, imgState, setImgSize } = useImage()
const imgIndex = ref(0)
const { lightboxInfoVisible } = storeToRefs(useMainStore())
const { downloadFile } = useDownload(urlTokenKey)
const { deleteItem } = useDeleteItems()

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

const current = ref<ISource>()

const currCursor = () => {
  if (status.loadError) return 'default'
  return 'move'
}

const fileInfo = ref<any>(null)

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

const {
  loading: infoLoading,
  load: loadInfo,
  refetch: refetchInfo,
} = initLazyQuery({
  handle: (data: any, error: string) => {
    if (error) {
      //toast(t(error), 'error')
    } else {
      if (data) {
        fileInfo.value = data.fileInfo
        updateViewOriginImageState()
      }
    }
  },
  document: fileInfoGQL,
  variables: () => ({
    id: current.value?.data?.id ?? '',
    path: current.value?.path ?? '',
  }),
  appApi: true,
})

function updateViewOriginImageState() {
  if (current.value && fileInfo.value && isImage(current.value.name) && current.value.path === fileInfo.value.path) {
    if (isSvg(current.value.name)) {
      current.value.viewOriginImage = true
    } else {
      const { width, height } = fileInfo.value.data
      if (width === imgState.naturalWidth && height === imgState.naturalHeight) {
        current.value.viewOriginImage = true
      }
    }
  }
}

const tagsMap = new Map<string, ITag[]>()
const { loading: tagsLoading, load: loadTags } = initLazyQuery({
  handle: (data: any, error: string) => {
    if (data) {
      tagsMap.set(current.value?.type ?? '', data.tags)
    }
  },
  document: tagsGQL,
  variables: () => ({
    type: current.value?.type ?? '',
  }),
  appApi: true,
})

const imgWrapperStyle = computed(() => {
  return {
    cursor: currCursor(),
    top: `calc(50% + ${imgWrapperState.top}px)`,
    left: `calc(50% + ${imgWrapperState.left}px)`,
    transition: status.dragging || status.gesturing ? 'none' : '',
    transform: `translate(-50%, -50%) scale(${imgWrapperState.scale}) rotate(${imgWrapperState.rotateDeg}deg)`,
  }
})

const closeDialog = () => {
  tempStore.lightbox.visible = false
  tempStore.lightbox.index = -1
  imgIndex.value = 0
}

function getResolution() {
  const width = fileInfo.value?.data?.width ?? 0
  const height = fileInfo.value?.data?.height ?? 0
  let r = `  ${width} x ${height}`
  if (isImage(current.value?.name ?? '')) {
    const mp = Math.round((width * height) / 1000000)
    if (mp > 1) {
      r += `  ${mp} MP`
    }
  }

  return r
}

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

// switching imgs manually
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
    if (type && !tagsMap.has(type)) {
      loadTags()
    }
    loadInfo()
  }, 0) // Fix the bug that graphql send the {id: '', path: ''} query at first time.

  // No emit event when hidden or same index
  if (oldIndex === newIndex) return

  if (actions) {
    if (isArray(actions)) {
      actions.forEach((action) => {
        emit(action, oldIndex, newIndex)
      })
    } else {
      emit(actions, oldIndex, newIndex)
    }
  }
  emit('on-index-change', oldIndex, newIndex)
}

const onNext = () => {
  const oldIndex = imgIndex.value
  const newIndex = props.loop ? (oldIndex + 1) % tempStore.lightbox.sources.length : oldIndex + 1

  if (!props.loop && newIndex > tempStore.lightbox.sources.length - 1) return

  changeIndex(newIndex, ['on-next', 'on-next-click'])
}

const onPrev = () => {
  const oldIndex = imgIndex.value
  let newIndex = oldIndex - 1

  if (oldIndex === 0) {
    if (!props.loop) return
    newIndex = tempStore.lightbox.sources.length - 1
  }
  changeIndex(newIndex, ['on-prev', 'on-prev-click'])
}

// actions for changing img
const defaultScale = 1.5
const zoom = (newScale: number) => {
  if (Math.abs(1 - newScale) < 0.05) {
    newScale = 1
  } else if (Math.abs(imgState.maxScale - newScale) < 0.05) {
    newScale = imgState.maxScale
  }
  imgWrapperState.lastScale = imgWrapperState.scale
  imgWrapperState.scale = newScale
}

const zoomIn = () => {
  const newScale = imgWrapperState.scale * defaultScale
  if (newScale < imgState.maxScale * 100) {
    zoom(newScale)
  }
}

const zoomOut = () => {
  const newScale = imgWrapperState.scale / defaultScale
  if (newScale > 0.1) {
    zoom(newScale)
  }
}

const rotateLeft = () => {
  imgWrapperState.rotateDeg -= 90
}

const rotateRight = () => {
  imgWrapperState.rotateDeg += 90
}

const resize = () => {
  imgWrapperState.scale = 1
  imgWrapperState.top = 0
  imgWrapperState.left = 0
}

// check img moveable
const canMove = (button?: number) => {
  return button === 0
}

// mouse
const { onMouseDown, onMouseMove, onMouseUp } = useMouse(imgWrapperState, status, canMove)

const { onTouchStart, onTouchMove, onTouchEnd } = useTouch(imgState, imgWrapperState, status, canMove)

const onDblclick = () => {
  if (imgWrapperState.scale !== imgState.maxScale) {
    imgWrapperState.lastScale = imgWrapperState.scale
    imgWrapperState.scale = imgState.maxScale
  } else {
    imgWrapperState.scale = imgWrapperState.lastScale
  }
}

const onWheel = (e: WheelEvent) => {
  if (status.loadError || status.gesturing || status.loading || status.dragging || status.wheeling) {
    return
  }

  status.wheeling = true

  setTimeout(() => {
    status.wheeling = false
  }, 80)

  if (e.deltaY < 0) {
    zoomIn()
  } else {
    zoomOut()
  }
}

let isVideoPlaying = true
const onPlaying = () => {
  isVideoPlaying = true
}
const onPause = () => {
  isVideoPlaying = false
}

// key press events handler
const onKeyPress = (e: Event) => {
  const evt = e as KeyboardEvent
  if (evt.key === 'Escape') {
    // if has md-dialog tag with attribute open should not close lightbox
    if (document.querySelector('md-dialog[open]')) return
    closeDialog()
  } else if (evt.key === 'ArrowLeft') {
    onPrev()
  } else if (evt.key === 'ArrowRight') {
    onNext()
  } else if (evt.key === ' ') {
    const v = video.value
    if (v) {
      if (v.paused && !isVideoPlaying) {
        v.play()
      } else {
        v.pause()
      }
    }
  }
}

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

const onWindowResize = () => {
  setImgSize()
}

watch(
  () => tempStore.lightbox.index,
  (newIndex) => {
    if (newIndex < 0 || newIndex >= tempStore.lightbox.sources.length) {
      return
    }
    changeIndex(newIndex)
  }
)

watch(
  () => status.dragging,
  (newStatus, oldStatus) => {
    const dragged = !newStatus && oldStatus
    if (!canMove() && dragged) {
      // if (status.swipeToLeft) {
      //   onNext()
      // } else if (status.swipeToRight) {
      //   onPrev()
      // }
    }
  }
)

function addToTags() {
  const type = current.value?.type ?? ''
  const tags = tagsMap.get(type) ?? []
  const item = current.value?.data ?? {}
  openModal(UpdateTagRelationsModal, {
    type,
    tags: tags,
    item: {
      key: item.id,
      title: item.title,
      size: item.size,
    },
    selected: tags.filter((it: ITag) => fileInfo.value?.tags.some((t: ITag) => t.id === it.id)),
  })
}

const itemTagsUpdatedHandler = (event: IItemTagsUpdatedEvent) => {
  if (event.item.key === current.value?.data?.id) {
    refetchInfo()
  }
}

const mediaItemDeletedHandler = (event: IMediaItemDeletedEvent) => {
  if (event.item.id === current.value?.data?.id) {
    remove(tempStore.lightbox.sources, (it: ISource) => it.data?.id === event.item.id)
    if (tempStore.lightbox.sources.length) {
      onNext()
    } else {
      closeDialog()
    }
  }
}

const fileDeletedHandler = (event: IFileDeletedEvent) => {
  if (event.item.path === current.value?.data?.path) {
    remove(tempStore.lightbox.sources, (it: ISource) => it.path === event.item.path)
    if (tempStore.lightbox.sources.length) {
      onNext()
    } else {
      closeDialog()
    }
  }
}

onMounted(() => {
  on(document, 'keydown', onKeyPress)
  on(window, 'resize', onWindowResize)
  emitter.on('item_tags_updated', itemTagsUpdatedHandler)
  emitter.on('media_item_deleted', mediaItemDeletedHandler)
  emitter.on('file_deleted', fileDeletedHandler)
})

onBeforeUnmount(() => {
  off(document, 'keydown', onKeyPress)
  off(window, 'resize', onWindowResize)
  emitter.off('item_tags_updated', itemTagsUpdatedHandler)
  emitter.off('media_item_deleted', mediaItemDeletedHandler)
  emitter.off('file_deleted', fileDeletedHandler)
})
</script>
<style lang="scss" scoped>
.v-on-error {
  position: absolute;
  top: 50%;
  left: 50%;
}

.toolbar {
  display: flex;
  flex-direction: row;
  padding-block: 8px;
  align-items: center;
  background: var(--md-sys-color-surface);
  z-index: 1;
  position: static;
  width: 100%;
  box-sizing: border-box;
  grid-area: toolbar;

  .source-name {
    flex: 1;

    .icon-button {
      margin-inline-start: 16px;
    }
  }

  md-outlined-button,
  .icon-button {
    margin-inline-end: 16px;
  }
}

.content {
  grid-area: content;
  position: relative;
  height: calc(100vh - 56px);
}

.info {
  grid-area: info;
  width: 280px;
  height: 100vh;
  box-sizing: border-box;
  background: var(--md-sys-color-surface-container);
  overflow-y: auto;
  z-index: 1;
}

.lightbox {
  min-width: var(--screen-min-width);
  background: var(--md-sys-color-surface);
  overflow: hidden;
}

.layout {
  display: grid;
  grid-template-areas:
    'toolbar info'
    'content info';
  grid-template-columns: 1fr auto;
  grid-template-rows: auto 1fr;
}

.v-img-wrapper {
  user-select: none;
  margin: 0;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50% -50%);
  transition: 0.3s linear;
  will-change: transform opacity;

  img {
    user-select: none;
    user-select: none;
    max-width: 90vw;
    max-height: 90vh;
    display: block;
    position: relative;

    @media (max-width: 750px) {
      max-width: 95vw;
      max-height: 95vh;
    }
  }
}

.v-video-wrapper,
.v-audio-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  height: 100%;

  audio {
    width: 400px;
  }

  video {
    height: 95%;
    max-width: 88%;
  }
}

.btn-prev,
.btn-next {
  user-select: none;
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  cursor: pointer;
  opacity: 0.6;
  font-size: 4rem;
  transition: 0.15s linear;
  outline: none;
  z-index: 1;
  &:hover {
    opacity: 1;
  }
}

.btn-next {
  right: 12px;
}

.btn-prev {
  left: 12px;
}
</style>
