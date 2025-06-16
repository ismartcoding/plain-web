<template>
  <div class="list-item-actions" :class="{ mobile: isPhone }">
    <template v-if="filter.trash">
      <v-icon-button v-tooltip="$t('delete')" class="sm" @click.stop.prevent="deleteItem(item)">
        <i-material-symbols:delete-forever-outline-rounded />
      </v-icon-button>
      <v-icon-button v-tooltip="$t('restore')" class="sm" :loading="restoreLoading(`ids:${item.id}`)" @click.stop.prevent="restore(`ids:${item.id}`)">
        <i-material-symbols:restore-from-trash-outline-rounded />
      </v-icon-button>
    </template>
    <template v-else>
      <v-icon-button v-tooltip="$t('move_to_trash')" class="sm" :loading="trashLoading(`ids:${item.id}`)" @click.stop.prevent="trash(`ids:${item.id}`)">
        <i-material-symbols:delete-outline-rounded />
      </v-icon-button>
      <v-icon-button v-tooltip="$t('add_to_tags')" class="sm" @click.stop.prevent="addItemToTags(item)">
        <i-material-symbols:label-outline-rounded />
      </v-icon-button>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { INote, IFilter } from '@/lib/interfaces'
import { useI18n } from 'vue-i18n'

const { t: $t } = useI18n()

interface Props {
  item: INote
  filter: IFilter
  isPhone?: boolean
  // Functions passed from parent
  deleteItem: (item: INote) => void
  addItemToTags: (item: INote) => void
  restoreLoading: (query: string) => boolean
  trashLoading: (query: string) => boolean
  restore: (query: string) => void
  trash: (query: string) => void
}

defineProps<Props>()
</script> 