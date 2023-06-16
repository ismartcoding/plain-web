<template>
  <Teleport to="body">
    <transition v-if="visible">
      <div @touchmove="preventDefault" class="v-modal" @click.self="closeDialog" @wheel="onWheel">
        <transition mode="out-in">
          <div>
            <div v-if="status.loading" class="loading">
              <div class="loader"></div>
            </div>
            <div v-else-if="status.loadError" class="v-on-error">{{ $t('load_failed', { name: current?.name }) }}</div>
            <div
              v-if="current && isVideo(current.name)"
              v-show="!status.loading && !status.loadError"
              class="v-video-wrapper"
              @click.self="closeDialog"
            >
              <video
                ref="video"
                controls
                autoplay="true"
                :src="current.src"
                @error="onError"
                @canplay="onLoad"
                @playing="onPlaying"
                @pause="onPause"
              />
              <div v-if="current.name" class="source-name">
                {{ current.name }}
              </div>
            </div>
            <div
              v-else-if="current && isAudio(current.name)"
              v-show="!status.loading && !status.loadError"
              class="v-audio-wrapper"
              @click.self="closeDialog"
            >
              <div style="padding: 50px">
                <audio controls autoplay="true" :src="current.src" @error="onError" @canplay="onLoad" />
                <div v-if="current.name" class="source-name">
                  {{ current.name }}
                </div>
              </div>
            </div>
            <div
              v-else-if="current && isImage(current.name)"
              v-show="!status.loading && !status.loadError"
              class="v-img-wrapper"
              :style="imgWrapperStyle"
            >
              <img
                ref="imgRef"
                draggable="false"
                class="v-img"
                :src="current?.src + (current?.viewOriginImage ? '' : '&w=1024&h=1024')"
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
          </div>
        </transition>
        <div class="buttons">
          <div v-if="sources.length > 1 && (loop || imgIndex > 0)" class="btn-prev" @click="onPrev">
            <i-material-symbols:chevron-left-rounded class="bi" />
          </div>
          <div v-if="sources.length > 1 && (loop || imgIndex < sources.length - 1)" class="btn-next" @click="onNext">
            <i-material-symbols:chevron-right-rounded class="bi" />
          </div>
          <div v-if="current && current.name && isImage(current.name)" class="source-name">
            {{ current.name }}
          </div>
          <div class="toolbar" v-if="current && (!current.name || isImage(current.name))">
            <div class="btn btn-sm" v-if="!current.viewOriginImage" @click="viewOrigin">
              {{ $t('view_origin_image') }}
            </div>

            <div class="toolbar-btn" @click="zoomIn">
              <i-material-symbols:zoom-in-rounded class="bi" />
            </div>

            <div class="toolbar-btn" @click="zoomOut">
              <i-material-symbols:zoom-out-rounded class="bi" />
            </div>

            <div class="toolbar-btn" @click="resize">
              <i-material-symbols:aspect-ratio-outline-rounded class="bi" />
            </div>

            <div class="toolbar-btn" @click="rotateLeft">
              <i-material-symbols:rotate-left-rounded class="bi" />
            </div>

            <div class="toolbar-btn" @click="rotateRight">
              <i-material-symbols:rotate-right-rounded class="bi" />
            </div>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>
<script setup lang="ts">
import { type PropType, computed, ref, reactive, watch, onMounted, onBeforeUnmount } from 'vue'

import { on, off, isArray, preventDefault } from './utils/index'
import { useImage, useMouse, useTouch } from './utils/hooks'
import type { ISource, IImgWrapperState, IndexChangeActions } from './types'
import { isVideo, isImage, isAudio } from '@/lib/file'
import { getFileUrlByPath } from '@/lib/api/file'
import { useTempStore } from '@/stores/temp'
import { storeToRefs } from 'pinia'

const props = defineProps({
  sources: {
    type: Array as PropType<ISource[]>,
    default: () => [],
  },
  visible: {
    type: Boolean,
    default: false,
  },
  index: {
    type: Number,
    default: 0,
  },
  swipeTolerance: {
    type: Number,
    default: 50,
  },
  loop: {
    type: Boolean,
    default: true,
  },
})

const emit = defineEmits([
  'hide',
  'on-error',
  'on-prev',
  'on-next',
  'on-prev-click',
  'on-next-click',
  'on-index-change',
])

const viewOrigin = () => {
  const c = current.value
  if (c) {
    c.viewOriginImage = true
  }
  status.loading = true
}
const { app } = storeToRefs(useTempStore())
const video = ref<HTMLVideoElement>()
const { imgRef, imgState, setImgSize } = useImage()
const imgIndex = ref(0)

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
  wheeling: false,
})

const current = ref<ISource>()

const currCursor = () => {
  if (status.loadError) return 'default'
  return 'move'
}

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
  emit('hide')
  imgIndex.value = 0
}

const reset = () => {
  imgWrapperState.scale = 1
  imgWrapperState.lastScale = 1
  imgWrapperState.rotateDeg = 0
  imgWrapperState.top = 0
  imgWrapperState.left = 0
  status.loadError = false
  status.dragging = false
  status.loading = true
}

// switching imgs manually
const changeIndex = async (newIndex: number, actions?: IndexChangeActions) => {
  const oldIndex = imgIndex.value

  reset()

  const s = props.sources[newIndex]
  if (!s.src) {
    const { fileIdToken } = app.value
    s.src = await getFileUrlByPath(fileIdToken, s.path)
  }

  imgIndex.value = newIndex
  current.value = props.sources[imgIndex.value]

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
  const newIndex = props.loop ? (oldIndex + 1) % props.sources.length : oldIndex + 1

  if (!props.loop && newIndex > props.sources.length - 1) return

  changeIndex(newIndex, ['on-next', 'on-next-click'])
}

const onPrev = () => {
  const oldIndex = imgIndex.value
  let newIndex = oldIndex - 1

  if (oldIndex === 0) {
    if (!props.loop) return
    newIndex = props.sources.length - 1
  }
  changeIndex(newIndex, ['on-prev', 'on-prev-click'])
}

// actions for changing img
const defaultScale = 0.2
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
  const newScale = imgWrapperState.scale + defaultScale
  if (newScale < imgState.maxScale * 3) {
    zoom(newScale)
  }
}

const zoomOut = () => {
  const newScale = imgWrapperState.scale - (imgWrapperState.scale < 0.7 ? 0.1 : defaultScale)
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
const canMove = (button = 0) => {
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
  () => props.index,
  (newIndex) => {
    if (newIndex < 0 || newIndex >= props.sources.length) {
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
      const xDiff = imgWrapperState.lastX - imgWrapperState.initX
      const yDiff = imgWrapperState.lastY - imgWrapperState.initY

      const tolerance = props.swipeTolerance
      const movedHorizontally = Math.abs(xDiff) > Math.abs(yDiff)

      if (movedHorizontally) {
        if (xDiff < tolerance * -1) onNext()
        else if (xDiff > tolerance) onPrev()
      }
    }
  }
)

onMounted(() => {
  on(document, 'keydown', onKeyPress)
  on(window, 'resize', onWindowResize)
})

onBeforeUnmount(() => {
  off(document, 'keydown', onKeyPress)
  off(window, 'resize', onWindowResize)
})
</script>
<style lang="scss" scoped>
.source-name {
  text-align: center;
  margin-top: 8px;
}

.v-on-error {
  position: absolute;
  top: 50%;
  left: 50%;
}

.toolbar {
  user-select: none;
  position: absolute;
  overflow: hidden;
  bottom: 1rem;
  left: 50%;
  transform: translate(-50%);
  display: flex;
  align-items: center;

  .toolbar-btn {
    user-select: none;
    flex-shrink: 0;
    cursor: pointer;
    padding: 8px 16px;
    font-size: 1.5rem;
    outline: none;
  }
}

.v-modal {
  z-index: 9998;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  margin: 0;
  background: var(--back-color);
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
    max-width: 80vw;
    max-height: 80vh;
    display: block;
    position: relative;

    @media (max-width: 750px) {
      max-width: 85vw;
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
  height: 100vh;

  audio {
    width: 400px;
  }

  video {
    height: 90vh;
  }
}

.buttons {
  .btn-prev,
  .btn-next {
    user-select: none;
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    cursor: pointer;
    opacity: 0.6;
    font-size: 4rem;
    color: #fff;
    transition: 0.15s linear;
    outline: none;

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
}
</style>
