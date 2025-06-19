<template>
  <header v-if="current" class="toolbar">
    <div v-if="current.name" class="source-name">
      <v-icon-button v-tooltip="$t('close')" class="close-btn" @click="$emit('close')">
        <i-material-symbols:close-rounded />
      </v-icon-button>
      <span class="file-name">{{ current.name }}</span>
    </div>

    <div class="actions">
      <template v-if="isImage(current.name)">
        <v-icon-button v-if="!current.viewOriginImage" v-tooltip="$t('view_origin_image')" @click="$emit('view-origin')">
          <i-material-symbols:image-outline-rounded />
        </v-icon-button>

        <v-icon-button v-tooltip="$t('zoom_in')" @click="$emit('zoom-in')">
          <i-material-symbols:zoom-in-rounded />
        </v-icon-button>

        <v-icon-button v-tooltip="$t('zoom_out')" @click="$emit('zoom-out')">
          <i-material-symbols:zoom-out-rounded />
        </v-icon-button>

        <v-icon-button v-tooltip="$t('resize')" @click="$emit('resize')">
          <i-material-symbols:aspect-ratio-outline-rounded />
        </v-icon-button>

        <v-icon-button v-tooltip="$t('rotate_left')" @click="$emit('rotate-left')">
          <i-material-symbols:rotate-left-rounded />
        </v-icon-button>

        <v-icon-button v-tooltip="$t('rotate_right')" @click="$emit('rotate-right')">
          <i-material-symbols:rotate-right-rounded />
        </v-icon-button>
      </template>
    </div>

    <v-icon-button v-tooltip="$t('info')" class="info-btn" @click="$emit('toggle-info')">
      <i-material-symbols:info-outline-rounded />
    </v-icon-button>
  </header>
</template>

<script setup lang="ts">
import { isImage } from '@/lib/file'
import type { ISource } from './types'

defineProps<{
  current: ISource | undefined
}>()

defineEmits<{
  close: []
  'view-origin': []
  'zoom-in': []
  'zoom-out': []
  resize: []
  'rotate-left': []
  'rotate-right': []
  'toggle-info': []
}>()
</script>

<style lang="scss" scoped>
.toolbar {
  display: flex;
  flex-direction: row;
  padding: 8px 12px;
  align-items: center;
  background: var(--md-sys-color-surface);
  z-index: 1;
  position: static;
  width: 100%;
  box-sizing: border-box;
  grid-area: toolbar;
  min-height: 56px;

  .source-name {
    flex: 1;
    display: flex;
    align-items: center;
    min-width: 0; /* Allow text truncation */
    margin-right: 8px;

    .close-btn {
      margin-right: 8px;
      flex-shrink: 0;
    }

    .file-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 14px;
    }
  }

  .actions {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    flex-wrap: wrap;
    gap: 4px;
  }

  .info-btn {
    width: 40px;
    height: 40px;
    margin: 0;
    flex-shrink: 0;
  }

  @media (max-width: 480px) {
    display: grid;
    grid-template-columns: 1fr auto;
    grid-template-rows: auto auto;
    grid-template-areas: 
      "source-name info-btn"
      "actions actions";
    gap: 8px;
    align-items: center;

    .source-name {
      grid-area: source-name;
      margin-right: 0;
    }

    .actions {
      grid-area: actions;
      justify-self: center;
    }

    .info-btn {
      grid-area: info-btn;
      justify-self: end;
    }
  }
}
</style>
