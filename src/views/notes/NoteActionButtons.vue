<template>
  <div class="actions">
    <template v-if="filter.trash">
      <template v-if="!confirming">
        <v-icon-button v-tooltip="$t('delete')" class="sm" @click.stop.prevent="confirming = true">
          <i-material-symbols:delete-forever-outline-rounded />
        </v-icon-button>
        <v-icon-button v-tooltip="$t('restore')" class="sm" :loading="restoreLoading(`ids:${item.id}`)" @click.stop.prevent="restore(`ids:${item.id}`)">
          <i-material-symbols:restore-from-trash-outline-rounded />
        </v-icon-button>
      </template>
      <inline-delete-confirm v-else :name="item.title" @confirm="onConfirmDelete" @cancel="confirming = false" />
    </template>
    <template v-else>
      <v-icon-button v-tooltip="$t('move_to_trash')" class="sm" :loading="trashLoading(`ids:${item.id}`)" @click.stop.prevent="trash(`ids:${item.id}`)">
        <i-material-symbols:delete-outline-rounded />
      </v-icon-button>
      <TagRelationsDropdown :type="dataType" :tags="tags" :item="{ key: item.id, title: '', size: 0 }" :selected="item.tags" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { INote, IFilter, ITag } from '@/lib/interfaces'
import { DataType } from '@/lib/data'
import { useI18n } from 'vue-i18n'

const { t: $t } = useI18n()

interface Props {
  item: INote
  filter: IFilter
  dataType: DataType
  tags: ITag[]
  // Functions passed from parent
  deleteItem: (item: INote) => void
  restoreLoading: (query: string) => boolean
  trashLoading: (query: string) => boolean
  restore: (query: string) => void
  trash: (query: string) => void
}

const props = defineProps<Props>()

const confirming = ref(false)

function onConfirmDelete() {
  props.deleteItem(props.item)
  confirming.value = false
}
</script> 