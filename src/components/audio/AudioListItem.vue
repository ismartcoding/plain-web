<template>
  <section
    v-if="!isPhone"
    class="media-item selectable-card"
    :class="{ selected: selectedIds.includes(item.id), selecting: shiftEffectingIds.includes(item.id) }"
    @click.stop="handleItemClick($event, item, index, () => play(item))"
    @mouseover="handleMouseOver($event, index)"
  >
    <div class="start">
      <v-checkbox v-if="shiftEffectingIds.includes(item.id)" class="checkbox" touch-target="wrapper" :checked="shouldSelect" @click.stop="toggleSelect($event, item, index)" />
      <v-checkbox v-else class="checkbox" touch-target="wrapper" :checked="selectedIds.includes(item.id)" @click.stop="toggleSelect($event, item, index)" />
      <span class="number"><field-id :id="index + 1" :raw="item" /></span>
    </div>
    <div class="image">
      <img v-if="imageErrorIds.includes(item.id)" :src="`/ficons/${getFileExtension(item.path)}.svg`" class="svg" />
      <img v-else class="image-thumb" :src="getFileUrl(item.albumFileId, '&w=200&h=200')" @error="onImageError(item.id)" />
    </div>
    <div class="title">{{ item.title }}</div>
    <div class="audio-item-subtitle">
      <span>{{ formatFileSize(item.size) }}</span>
      <span class="duration">
        {{ formatSeconds(item.duration) }}
      </span>
      <a @click.stop.prevent="viewBucket(mainStore, item.bucketId)">{{ bucketsMap[item.bucketId]?.name }}</a>
      <item-tags :tags="item.tags" :type="dataType" :only-links="true" />
    </div>
    <AudioActionButtons
      :item="item"
      :filter="filter"
      :data-type="dataType"
      :animating-ids="animatingIds"
      :play-loading="playLoading"
      :play-path="playPath"
      :app="app"
      :delete-item="deleteItem"
      :restore="restore"
      :download-file="downloadFile"
      :trash="trash"
      :handle-remove-from-playlist="handleRemoveFromPlaylist"
      :add-to-playlist="addToPlaylist"
      :add-item-to-tags="addItemToTags"
      :pause="pause"
      :is-audio-playing="isAudioPlaying"
      :is-in-playlist="isInPlaylist"
      :restore-loading="restoreLoading"
      :trash-loading="trashLoading"
    />
    <div class="artist">{{ item.artist }}</div>
    <div class="time">
      <span v-tooltip="formatDateTime(item.createdAt)">
        {{ formatTimeAgo(item.createdAt) }}
      </span>
    </div>
  </section>

  <!-- phone Layout -->
  <section
    v-else
    class="media-item-phone selectable-card"
    :class="{ selected: selectedIds.includes(item.id), selecting: shiftEffectingIds.includes(item.id) }"
    @click.stop="handleItemClick($event, item, index, () => play(item))"
    @mouseover="handleMouseOver($event, index)"
  >
    <div class="phone-left">
      <v-checkbox v-if="shiftEffectingIds.includes(item.id)" class="checkbox" touch-target="wrapper" :checked="shouldSelect" @click.stop="toggleSelect($event, item, index)" />
      <v-checkbox v-else class="checkbox" touch-target="wrapper" :checked="selectedIds.includes(item.id)" @click.stop="toggleSelect($event, item, index)" />
      <div class="image">
        <img v-if="imageErrorIds.includes(item.id)" :src="`/ficons/${getFileExtension(item.path)}.svg`" class="svg" />
        <img v-else class="image-thumb" :src="getFileUrl(item.albumFileId, '&w=200&h=200')" @error="onImageError(item.id)" />
      </div>
    </div>
    
    <div class="phone-content">
      <div class="title">{{ item.title }}</div>
      <div class="audio-item-subtitle">
        <span>{{ formatFileSize(item.size) }}</span>
        <span class="duration">{{ formatSeconds(item.duration) }}</span>
        <a @click.stop.prevent="viewBucket(mainStore, item.bucketId)">{{ bucketsMap[item.bucketId]?.name }}</a>
        <item-tags :tags="item.tags" :type="dataType" :only-links="true" />
      </div>
      <div class="artist-time">
        <span v-if="item.artist" class="artist">{{ item.artist }}</span>
        <span class="time">{{ formatTimeAgo(item.createdAt) }}</span>
      </div>
      
      <AudioActionButtons
        :item="item"
        :filter="filter"
        :data-type="dataType"
        :animating-ids="animatingIds"
        :play-loading="playLoading"
        :play-path="playPath"
        :app="app"
        :is-phone="true"
        :delete-item="deleteItem"
        :restore="restore"
        :download-file="downloadFile"
        :trash="trash"
        :handle-remove-from-playlist="handleRemoveFromPlaylist"
        :add-to-playlist="addToPlaylist"
        :add-item-to-tags="addItemToTags"
        :pause="pause"
        :is-audio-playing="isAudioPlaying"
        :is-in-playlist="isInPlaylist"
        :restore-loading="restoreLoading"
        :trash-loading="trashLoading"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import type { IAudio, IBucket, IFilter } from '@/lib/interfaces'
import { DataType } from '@/lib/data'
import { formatFileSize, formatSeconds, formatDateTime, formatTimeAgo } from '@/lib/format'
import { getFileUrl, getFileExtension } from '@/lib/api/file'
import AudioActionButtons from './AudioActionButtons.vue'

interface Props {
  item: IAudio
  index: number
  selectedIds: string[]
  shiftEffectingIds: string[]
  shouldSelect: boolean
  isPhone: boolean
  imageErrorIds: string[]
  bucketsMap: Record<string, IBucket>
  filter: IFilter
  dataType: DataType
  animatingIds: string[]
  playLoading: boolean
  playPath: string
  mainStore: any
  app: any
  // Functions passed from parent
  handleItemClick: (event: MouseEvent, item: IAudio, index: number, callback: () => void) => void
  handleMouseOver: (event: MouseEvent, index: number) => void
  toggleSelect: (event: MouseEvent, item: IAudio, index: number) => void
  onImageError: (id: string) => void
  viewBucket: (store: any, bucketId: string) => void
  deleteItem: (dataType: DataType, item: IAudio) => void
  restore: (dataType: DataType, query: string) => void
  downloadFile: (path: string, fileName: string) => void
  trash: (dataType: DataType, query: string) => void
  handleRemoveFromPlaylist: (event: MouseEvent, item: IAudio) => void
  addToPlaylist: (event: MouseEvent, item: IAudio) => void
  addItemToTags: (item: IAudio) => void
  play: (item: IAudio) => void
  pause: () => void
  isAudioPlaying: (item: IAudio) => boolean
  isInPlaylist: (item: IAudio) => boolean
  restoreLoading: (query: string) => boolean
  trashLoading: (query: string) => boolean
}

defineProps<Props>()
</script>

<style scoped lang="scss">
.media-item-phone {
  display: flex;
  gap: 8px;
  border-radius: 8px;
  padding-block-end: 8px;
  padding-inline-end: 8px;
  
  .phone-left {
    display: flex;
    flex-direction: column;
    gap: 8px;
    
    .image {
      width: 48px;
      height: 48px;
      margin-inline-start: 6px;
      text-align: center;
      .svg {
        max-width: 48px;
        max-height: 48px;
      }
    }
  }
  
  .phone-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .title {
    font-weight: bold;
    word-break: break-all;
    margin-block-start: 8px;
  }

  .artist-time {
    display: flex;
    gap: 8px;
    color: var(--md-sys-color-on-surface-variant);
    font-size: 0.875rem;
  }
}
</style>
