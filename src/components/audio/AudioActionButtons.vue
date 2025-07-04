<template>
  <div class="actions">
    <template v-if="filter.trash">
      <v-icon-button v-tooltip="$t('delete')" class="sm" @click.stop="deleteItem(dataType, item)">
          <i-material-symbols:delete-forever-outline-rounded />
      </v-icon-button>
      <v-icon-button v-tooltip="$t('restore')" class="sm" :loading="restoreLoading(`ids:${item.id}`)" @click.stop="restore(dataType, `ids:${item.id}`)">
          <i-material-symbols:restore-from-trash-outline-rounded />
      </v-icon-button>
      <v-icon-button v-tooltip="$t('download')" class="sm" @click.stop="downloadFile(item.path, getFileName(item.path).replace(' ', '-'))">
          <i-material-symbols:download-rounded />
      </v-icon-button>
    </template>
    <template v-else>
      <v-icon-button
        v-if="hasFeature(FEATURE.MEDIA_TRASH, app.osVersion)"
        v-tooltip="$t('move_to_trash')"
        class="sm"
        :loading="trashLoading(`ids:${item.id}`)"
        @click.stop="trash(dataType, `ids:${item.id}`)"
      >
          <i-material-symbols:delete-outline-rounded />
      </v-icon-button>
      <v-icon-button v-else v-tooltip="$t('delete')" class="sm" @click.stop="deleteItem(dataType, item)">
          <i-material-symbols:delete-forever-outline-rounded />
      </v-icon-button>
      <v-icon-button v-tooltip="$t('download')" class="sm" @click.stop="downloadFile(item.path, getFileName(item.path).replace(' ', '-'))">
          <i-material-symbols:download-rounded />
      </v-icon-button>
      <v-icon-button v-if="isInPlaylist(item) && !animatingIds.includes(item.id)" v-tooltip="$t('remove_from_playlist')" class="sm" @click.stop.prevent="handleRemoveFromPlaylist($event, item)">
          <i-material-symbols:playlist-remove class="playlist-remove-icon" />
      </v-icon-button>
      <v-icon-button v-else-if="isInPlaylist(item) && animatingIds.includes(item.id)" class="sm" :disabled="true">
          <i-material-symbols:playlist-remove class="playlist-remove-icon rotating" />
      </v-icon-button>
      <v-icon-button v-else-if="!isInPlaylist(item) && !animatingIds.includes(item.id)" v-tooltip="$t('add_to_playlist')" class="sm" @click.stop.prevent="addToPlaylist($event, item)">
          <i-material-symbols:playlist-add class="playlist-add-icon" />
      </v-icon-button>
      <v-icon-button v-else-if="!isInPlaylist(item) && animatingIds.includes(item.id)" class="sm" :disabled="true">
          <i-material-symbols:playlist-add class="playlist-add-icon rotating" />
      </v-icon-button>
      <v-icon-button v-tooltip="$t('add_to_tags')" class="sm" @click.stop="addItemToTags(item)">
          <i-material-symbols:label-outline-rounded />
      </v-icon-button>
    </template>
    <v-circular-progress v-if="playLoading && item.path === playPath" indeterminate class="sm" />
    <v-icon-button v-else-if="isAudioPlaying(item)" v-tooltip="$t('pause')" class="sm" @click.stop="pause()">
        <i-material-symbols:pause-circle-outline-rounded />
    </v-icon-button>
  </div>
</template>

<script setup lang="ts">
import type { IAudio, IFilter } from '@/lib/interfaces'
import { DataType, FEATURE } from '@/lib/data'
import { getFileName } from '@/lib/api/file'
import { hasFeature } from '@/lib/feature'
import { useI18n } from 'vue-i18n'

const { t: $t } = useI18n()

interface Props {
  item: IAudio
  filter: IFilter
  dataType: DataType
  animatingIds: string[]
  playLoading: boolean
  playPath: string
  app: any
  // Functions passed from parent
  deleteItem: (dataType: DataType, item: IAudio) => void
  restore: (dataType: DataType, query: string) => void
  downloadFile: (path: string, fileName: string) => void
  trash: (dataType: DataType, query: string) => void
  handleRemoveFromPlaylist: (event: MouseEvent, item: IAudio) => void
  addToPlaylist: (event: MouseEvent, item: IAudio) => void
  addItemToTags: (item: IAudio) => void
  pause: () => void
  isAudioPlaying: (item: IAudio) => boolean
  isInPlaylist: (item: IAudio) => boolean
  restoreLoading: (query: string) => boolean
  trashLoading: (query: string) => boolean
}

defineProps<Props>()
</script>