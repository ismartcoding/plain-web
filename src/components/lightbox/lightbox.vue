<template>
  <Teleport to="body">
    <div v-if="tempStore.lightbox.visible" class="lightbox" @touchmove="preventDefault" @wheel="onWheel">
      <div class="layout">
        <LightboxHeader 
          :current="current"
          @close="closeDialog"
          @view-origin="viewOrigin"
          @zoom-in="zoomIn"
          @zoom-out="zoomOut"
          @resize="resize"
          @rotate-left="rotateLeft"
          @rotate-right="rotateRight"
          @toggle-info="lightboxInfoVisible = !lightboxInfoVisible"
        />
        <section class="content" @click.self="closeDialog">
          <div v-if="tempStore.lightbox.sources.length > 1 && (loop || imgIndex > 0)" class="btn-prev" @click="onPrev">
            <i-material-symbols:chevron-left-rounded />
          </div>
          <div v-if="tempStore.lightbox.sources.length > 1 && (loop || imgIndex < tempStore.lightbox.sources.length - 1)" class="btn-next" @click="onNext">
            <i-material-symbols:chevron-right-rounded />
          </div>
          <div v-if="status.loading" class="loading">
            <v-circular-progress indeterminate />
          </div>
          <div v-else-if="status.loadError" class="v-on-error">
            {{ $t('load_failed', { name: current?.name }) }}
          </div>
          <div v-if="current && isVideo(current.name)" v-show="!status.loading && !status.loadError" class="v-video-wrapper" @click.self="closeDialog">
            <video ref="video" controls autoplay="true" :src="current.src" @error="onError" @canplay="onLoad" @playing="onPlaying" @pause="onPause" @volumechange="onVolumeChange" />
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
        
        <!-- Desktop info panel -->
        <LightboxInfo 
          v-if="lightboxInfoVisible && !isPhone && !isTablet" 
          :current="current" 
          :file-info="fileInfo" 
          :url-token-key="urlTokenKey ? urlTokenKey.toString() : ''" 
          :app-dir="app.appDir" 
          :tags-map="tagsMap" 
          :os-version="app.osVersion"
          :download-file="downloadFile"
          @rename-file="renameFile"
          @delete-file="deleteFile"
          @add-to-tags="addToTags"
          @refetch-info="refetchInfo"
        />
      </div>
      
      <!-- Mobile info bottom sheet -->
      <BottomSheet v-if="isPhone || isTablet" v-model="lightboxInfoVisible" :title="$t('info')" show-footer>
        <!-- File Details Section -->
        <LightboxFileDetails 
          :current="current" 
          :file-info="fileInfo" 
          :app-dir="app.appDir" 
        />
        
        <!-- File Tags Section -->
        <LightboxFileTags 
          :current="current" 
          :file-info="fileInfo"
          @add-to-tags="addToTags"
        />
        
        <!-- Action Buttons in Footer -->
        <template #footer>
          <LightboxFileActionButtons 
            :current="current" 
            :os-version="app.osVersion"
            :download-file="downloadFile"
            @rename-file="renameFile"
            @delete-file="deleteFile"
            @action-success="handleActionSuccess"
          />
        </template>
      </BottomSheet>
    </div>
  </Teleport>
</template>
<script setup lang="ts">
import { inject, toRef } from 'vue'
import { preventDefault } from './utils/index'
import { isVideo, isImage, isAudio, isSvg } from '@/lib/file'
import {
  useLightboxState,
  useLightboxQueries,
  useLightboxTransform,
  useLightboxNavigation,
  useLightboxFileActions,
  useLightboxEvents,
  useLightboxMouseTouch,
} from '@/hooks/lightbox'

const props = defineProps({
  loop: { type: Boolean, default: true },
})

const emit = defineEmits(['on-error', 'on-prev', 'on-next', 'on-prev-click', 'on-next-click', 'on-index-change'])

const isPhone = inject('isPhone') as boolean
const isTablet = inject('isTablet') as boolean

const {
  tempStore, urlTokenKey, app, lightboxInfoVisible,
  imgRef, imgState, setImgSize, imgIndex,
  current, fileInfo, video,
  imgWrapperState, status, imgWrapperStyle,
} = useLightboxState(isPhone)

const { loadInfo, refetchInfo, updateViewOriginImageState, tagsMap, loadTags } =
  useLightboxQueries(current, fileInfo, imgState)

const { zoomIn, zoomOut, rotateLeft, rotateRight, resize, onDblclick, onWheel } =
  useLightboxTransform(imgWrapperState, imgState, status)

const { closeDialog, changeIndex, onNext, onPrev } =
  useLightboxNavigation(tempStore, imgIndex, current, imgWrapperState, status, tagsMap, loadTags, loadInfo, toRef(props, 'loop'), emit as (event: string, ...args: any[]) => void)

const { downloadFile, deleteFile, renameFile, addToTags, handleActionSuccess, viewOrigin: viewOriginAction } =
  useLightboxFileActions(current, fileInfo, tagsMap, urlTokenKey, refetchInfo, isPhone, lightboxInfoVisible)

const viewOrigin = () => {
  viewOriginAction()
  status.loading = true
}

const { onLoad, onError, onPlaying, onPause, onVolumeChange } =
  useLightboxEvents(tempStore, current, video, status, imgState, imgIndex, setImgSize, refetchInfo, updateViewOriginImageState, closeDialog, onNext, onPrev, changeIndex, emit as (event: string, ...args: any[]) => void)

const { onMouseDown, onMouseMove, onMouseUp, onTouchStart, onTouchMove, onTouchEnd } =
  useLightboxMouseTouch(imgWrapperState, imgState, status)
</script>
<style lang="scss" scoped>
.v-on-error {
  position: absolute;
  top: 50%;
  left: 50%;
}

.loading {
  position: absolute;
  top: 50%;
  left: 50%;
  opacity: 0;
  animation: showDiv 0.5s ease-in-out 0.5s forwards;
}

.content {
  grid-area: content;
  position: relative;
  height: calc(100vh - 56px);

  /* Mobile layout adjustment */
  @media (max-width: 480px) {
    height: calc(100vh - 112px); /* Account for two-row header on mobile */
  }
}

.lightbox {
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

/* Mobile BottomSheet styles */
.lightbox :deep(.bottom-sheet-content) {
  padding-inline: 24px;
  padding-block: 0;
  max-height: 70vh;
  overflow-y: auto;
}

.lightbox :deep(.bottom-sheet-footer) {
  padding: 16px 24px 24px 24px;
  border-top: 1px solid var(--md-sys-color-outline-variant);
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
