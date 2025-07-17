<template>
  <section
    v-if="!isPhone"
    class="file-item recent-file-item selectable-card"
    :class="{ selected: selectedIds.includes(item.id), selecting: shiftEffectingIds.includes(item.id) }"
    @click.stop="handleItemClick($event, item, index, () => clickItem(item))"
    @mouseenter.stop="handleMouseOver($event, index)"
  >
    <div class="start">
      <v-checkbox v-if="shiftEffectingIds.includes(item.id)" class="checkbox" touch-target="wrapper" :checked="shouldSelect" @click.stop="toggleSelect($event, item, index)" />
      <v-checkbox v-else class="checkbox" touch-target="wrapper" :checked="selectedIds.includes(item.id)" @click.stop="toggleSelect($event, item, index)" />
      <span class="number"><field-id :id="index + 1" :raw="item" /></span>
    </div>
    <div class="image" @click.stop="clickItem(item)">
      <img v-if="extensionImageErrorIds.includes(item.id)" class="svg" src="/ficons/default.svg" />
      <img v-else-if="!imageErrorIds.includes(item.id) && item.fileId" class="image-thumb" :src="getFileUrl(item.fileId, '&w=50&h=50')" @error="onImageError(item.id)" />
      <img v-else-if="item.extension" :src="`/ficons/${item.extension}.svg`" class="svg" @error="onExtensionImageError(item.id)" />
      <img v-else class="svg" src="/ficons/default.svg" />
    </div>
    <div class="title">
      {{ item.name }}
    </div>
    <div class="subtitle">
      <span>{{ formatFileSize(item.size) }}</span>
      <span v-tooltip="formatDateTime(item.updatedAt)">{{ formatTimeAgo(item.updatedAt) }}</span>
    </div>
    <div class="actions">
      <v-icon-button v-tooltip="$t('download')" @click.stop="downloadFile(item.path)">
        <i-material-symbols:download-rounded />
      </v-icon-button>

      <popper>
        <v-icon-button v-tooltip="$t('info')">
          <i-material-symbols:info-outline-rounded />
        </v-icon-button>
        <template #content>
          <section class="card card-info">
            <div class="key-value vertical">
              <div class="key">{{ $t('path') }}</div>
              <div class="value">
                {{ item.path }}
              </div>
            </div>
          </section>
        </template>
      </popper>
    </div>
  </section>

  <!-- Phone Layout -->
  <ListItemPhone
    v-else
    :is-selected="selectedIds.includes(item.id)"
    :is-selecting="shiftEffectingIds.includes(item.id)"
    :checkbox-checked="shiftEffectingIds.includes(item.id) ? shouldSelect : selectedIds.includes(item.id)"
    @click="handleItemClick($event, item, index, () => clickItem(item))"
    @mouseenter.stop="handleMouseOver($event, index)"
    @checkbox-click="(event: MouseEvent) => toggleSelect(event, item, index)"
  >
    <template #image>
      <div class="image" @click.stop="clickItem(item)">
        <img v-if="extensionImageErrorIds.includes(item.id)" class="svg" src="/ficons/default.svg" />
        <img v-else-if="!imageErrorIds.includes(item.id) && item.fileId" class="image-thumb" :src="getFileUrl(item.fileId, '&w=50&h=50')" @error="onImageError(item.id)" />
        <img v-else-if="item.extension" :src="`/ficons/${item.extension}.svg`" class="svg" @error="onExtensionImageError(item.id)" />
        <img v-else class="svg" src="/ficons/default.svg" />
      </div>
    </template>
    
    <template #title>{{ item.name }}</template>
    
    <template #subtitle>
      <span>{{ formatFileSize(item.size) }}</span>
      <span v-tooltip="formatDateTime(item.updatedAt)">{{ formatTimeAgo(item.updatedAt) }}</span>
    </template>
    
    <template #actions>
      <div class="actions">
        <v-icon-button v-tooltip="$t('download')" @click.stop="downloadFile(item.path)">
          <i-material-symbols:download-rounded />
        </v-icon-button>

        <popper>
          <v-icon-button v-tooltip="$t('info')">
            <i-material-symbols:info-outline-rounded />
          </v-icon-button>
          <template #content>
            <section class="card card-info">
              <div class="key-value vertical">
                <div class="key">{{ $t('path') }}</div>
                <div class="value">
                  {{ item.path }}
                </div>
              </div>
            </section>
          </template>
        </popper>
      </div>
    </template>
  </ListItemPhone>
</template>

<script setup lang="ts">
import type { IFile } from '@/lib/file'
import { formatFileSize, formatDateTime, formatTimeAgo } from '@/lib/format'
import { getFileUrl } from '@/lib/api/file'

interface Props {
  item: IFile
  index: number
  selectedIds: string[]
  shiftEffectingIds: string[]
  shouldSelect: boolean
  isPhone: boolean
  imageErrorIds: string[]
  extensionImageErrorIds: string[]
  // Functions passed from parent
  handleItemClick: (event: MouseEvent, item: IFile, index: number, callback: () => void) => void
  handleMouseOver: (event: MouseEvent, index: number) => void
  toggleSelect: (event: MouseEvent, item: IFile, index: number) => void
  onImageError: (id: string) => void
  onExtensionImageError: (id: string) => void
  downloadFile: (path: string) => void
  clickItem: (item: IFile) => void
}

defineProps<Props>()
</script>

<style scoped lang="scss">
.list-item-phone {
  margin-block-end: 8px;
}
</style> 