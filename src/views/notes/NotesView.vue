<template>
  <div class="top-app-bar">
    <v-checkbox touch-target="wrapper" :checked="allChecked" :indeterminate="!allChecked && checked" @change="toggleAllChecked" />
    <div class="title">
      <span v-if="selectedIds.length">{{ $t('x_selected', { count: realAllChecked ? total.toLocaleString() : selectedIds.length.toLocaleString() }) }}</span>
      <span v-else>{{ $t('page_title.notes') }} ({{ total.toLocaleString() }})</span>
      <template v-if="checked">
        <template v-if="filter.trash">
          <v-icon-button v-tooltip="$t('delete')" @click.stop="deleteItems(selectedIds, realAllChecked, total, q)">
            <i-material-symbols:delete-forever-outline-rounded />
          </v-icon-button>
          <v-icon-button v-tooltip="$t('restore')" :loading="restoreLoading(getQuery())" @click.stop="restore(getQuery())">
            <i-material-symbols:restore-from-trash-outline-rounded />
          </v-icon-button>
        </template>
        <template v-else>
          <v-icon-button v-tooltip="$t('move_to_trash')" @click.stop="trash(getQuery())">
            <i-material-symbols:delete-outline-rounded />
          </v-icon-button>
          <v-icon-button v-tooltip="$t('add_to_tags')" @click.stop="addToTags(selectedIds, realAllChecked, q)">
            <i-material-symbols:label-outline-rounded />
          </v-icon-button>
          <v-icon-button v-tooltip="$t('export_notes')" @click.stop="exportNotes2">
            <i-material-symbols:export-notes-outline-rounded />
          </v-icon-button>
        </template>
      </template>
    </div>
    <div class="actions">
      <v-outlined-button v-if="!filter.trash" class="btn-sm" @click.prevent="create">{{ $t('create') }}</v-outlined-button>
    </div>
  </div>
  <all-checked-alert
    :limit="limit"
    :total="total"
    :all-checked-alert-visible="allCheckedAlertVisible"
    :real-all-checked="realAllChecked"
    :select-real-all="selectRealAll"
    :clear-selection="clearSelection"
  />
  <div v-if="loading && items.length === 0" class="scroller main-list">
    <NoteSkeletonItem v-for="i in 20" :key="i" :index="i" :is-phone="isPhone" />
  </div>
  <VirtualList v-if="items.length" class="scroller main-list" :data-key="'id'" :data-sources="items" :estimate-size="100" :class="{ 'select-mode': checked }">
    <template #item="{ index, item }">
      <a :key="item.id" class="item-link" :href="viewUrl(item)">
        <NoteListItem
          :item="item"
          :index="index"
          :selected-ids="selectedIds"
          :shift-effecting-ids="shiftEffectingIds"
          :should-select="shouldSelect"
          :is-phone="isPhone"
          :filter="filter"
          :data-type="dataType"
          :route-id="$route.params['id'] as string"
          :handle-item-click="handleItemClick"
          :handle-mouse-over="handleMouseOver"
          :toggle-select="toggleSelect"
          :view="view"
          :delete-item="deleteItem"
          :add-item-to-tags="addItemToTags"
          :restore-loading="restoreLoading"
          :trash-loading="trashLoading"
          :restore="restore"
          :trash="trash"
        />
      </a>
    </template>
    <template #footer>
      <v-pagination v-if="total > limit" :page="page" :go="gotoPage" :total="total" :limit="limit" :page-size="limit" :on-change-page-size="onChangePageSize" />
    </template>
  </VirtualList>
  <div v-if="!loading && items.length === 0" class="no-data-placeholder">
    {{ $t(noDataKey(loading)) }}
  </div>
</template>

<script setup lang="ts">
import { inject } from 'vue'
import { noDataKey } from '@/lib/list'
import VirtualList from '@/components/virtualscroll'
import NoteListItem from '@/views/notes/NoteListItem.vue'
import { useNotesData } from './hooks/useNotesData'
import { useNotesActions } from './hooks/useNotesActions'

const isPhone = inject('isPhone') as boolean

const {
  items, filter, page, limit, q, loading, fetch, tags, dataType,
  selectedIds, allChecked, realAllChecked, selectRealAll, allCheckedAlertVisible,
  clearSelection, toggleAllChecked, toggleSelect, total, checked,
  shiftEffectingIds, handleItemClick, handleMouseOver, shouldSelect,
  gotoPage, onChangePageSize,
} = useNotesData(() => {
  deleteItems(selectedIds.value, realAllChecked.value, total.value, q.value)
})

const {
  addToTags, deleteItems, deleteItem, addItemToTags,
  exportNotes2, getQuery, trashLoading, trash, restoreLoading, restore,
  view, viewUrl, create,
} = useNotesActions({ items, selectedIds, realAllChecked, q, total, tags, clearSelection, fetch })
</script>
<style lang="scss" scoped>
.scroller {
  overflow-y: auto;
  overflow-x: hidden;
  height: calc(100vh - 112px);
  .item-link {
    text-decoration: none;
    display: block;
  }
}

:deep(.note-item) {
  margin-block-end: 8px;
  grid-template-areas:
    'start title actions time'
    'start subtitle actions time';
  grid-template-columns: 48px 2fr 100px minmax(100px, 1fr);
  &:hover {
    cursor: pointer;
  }
  .title {
    grid-area: title;
    font-weight: normal;
    margin-inline-end: 16px;
    padding-block-start: 12px;
  }
  .subtitle {
    grid-area: subtitle;
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    font-size: 0.875rem;
    margin-inline-end: 16px;
    margin-block-end: 12px;
    margin-block-start: 8px;
  }
  .time {
    grid-area: time;
    display: flex;
    align-items: center;
    padding-inline: 16px;
    justify-content: end;
  }
}
</style>
