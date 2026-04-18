<template>
  <MediaToolbar
    page-title="page_title.images"
    :selected-count="selectedIds.length"
    :all-checked="allChecked" :checked="checked" :real-all-checked="realAllChecked" :total="total"
    :filter-trash="!!filter.trash"
    :can-trash="hasFeature(FEATURE.MEDIA_TRASH, app.osVersion)"
    :restore-query-loading="restoreLoading(getQuery())" :trash-query-loading="trashLoading(getQuery())"
    :limit="limit" :all-checked-alert-visible="allCheckedAlertVisible"
    :show-secondary="isPhone && !checked"
    @toggle-all-checked="toggleAllChecked" @delete="deleteItems(dataType, selectedIds, realAllChecked, total, q)"
    @restore="restore(dataType, getQuery())" @download="downloadItems(realAllChecked, selectedIds, q)"
    @trash="trash(dataType, getQuery())" @add-to-tags="addToTags(selectedIds, realAllChecked, q)"
    @select-real-all="selectRealAll" @clear-selection="clearSelection"
  >
    <template #actions>
      <ImageSearchButton />
      <MediaPageActions v-bind="actionsProps" placement="top"
        :on-upload-files="uploadFilesClick" :on-upload-dir="uploadDirClick"
      />
    </template>
    <template #secondary>
      <MediaPageActions v-bind="actionsProps" placement="secondary" />
    </template>
  </MediaToolbar>

  <div class="scroll-content" @dragover.stop.prevent="fileDragEnter">
    <div v-show="dropping" class="drag-mask" @drop.stop.prevent="dropFiles2" @dragleave.stop.prevent="fileDragLeave">{{ $t('release_to_send_files') }}</div>

    <template v-if="effectiveIsGroupMode">
      <template v-if="loading && items.length === 0">
        <div class="media-grid"><section v-for="i in limit" :key="i" class="skeleton-image media-item"></section></div>
      </template>
      <div v-for="group in groupedItems" :key="group.date" class="image-group">
        <div class="group-date-label">{{ group.dateLabel }}</div>
        <div class="media-grid" :class="{ 'select-mode': checked }">
          <MediaGridItem v-for="{ item, idx } in group.entries" :key="item.id" :item="item" :checked="checked"
            :selected-ids="selectedIds" :shift-effecting-ids="shiftEffectingIds" :should-select="shouldSelect" :data-type="dataType"
            @item-click="(e) => handleItemClick(e, item, idx, view)" @item-mouse-enter="(e) => handleMouseOverMode(e, idx)"
            @toggle-select="(e) => toggleSelect(e, item, idx)" @view="view(idx)">
            <template #thumbnail><img class="image-thumb image" :src="getFileUrl(item.fileId, '&w=512&h=512')" onerror="this.src='/broken-image.png'" /></template>
            <template #info-right>{{ formatFileSize(item.size) }}</template>
          </MediaGridItem>
        </div>
      </div>
    </template>

    <div v-else-if="!mainStore.imagesCardView" class="media-grid" :class="{ 'select-mode': checked }">
      <MediaGridItem v-for="(item, i) in items" :key="item.id" :item="item" :checked="checked"
        :selected-ids="selectedIds" :shift-effecting-ids="shiftEffectingIds" :should-select="shouldSelect" :data-type="dataType"
        @item-click="(e) => handleItemClick(e, item, i, view)" @item-mouse-enter="(e) => handleMouseOverMode(e, i)"
        @toggle-select="(e) => toggleSelect(e, item, i)" @view="view(i)">
        <template #thumbnail><img class="image-thumb image" :src="getFileUrl(item.fileId, '&w=512&h=512')" onerror="this.src='/broken-image.png'" /></template>
        <template #info-right>{{ formatFileSize(item.size) }}</template>
      </MediaGridItem>
      <template v-if="loading && items.length === 0"><section v-for="i in limit" :key="i" class="skeleton-image media-item"></section></template>
    </div>

    <div v-else class="main-list media-list" :class="{ 'select-mode': checked }">
      <ImageListItem v-for="(item, i) in items" :key="item.id" :item="item" :index="i" :is-phone="isPhone"
        :selected-ids="selectedIds" :shift-effecting-ids="shiftEffectingIds" :should-select="shouldSelect"
        :buckets-map="bucketsMap" :filter="filter" :data-type="dataType" :main-store="mainStore" :app="app"
        :handle-item-click="handleItemClick" :handle-mouse-over="handleMouseOverMode" :toggle-select="toggleSelect"
        :view-bucket="viewBucket" :delete-item="deleteItem" :restore="restore" :download-file="downloadFile"
        :trash="trash" :add-item-to-tags="addItemToTags" :view="view"
        :restore-loading="restoreLoading" :trash-loading="trashLoading" />
      <image-video-list-skeleton v-if="loading && items.length === 0" :limit="limit" :is-phone="isPhone" />
    </div>

    <div v-if="!loading && items.length === 0" class="no-data-placeholder">{{ $t(noDataKey(loading, app.permissions, 'WRITE_EXTERNAL_STORAGE')) }}</div>
    <v-pagination v-if="!scrollMode && total > limit" :page="page" :go="gotoPage" :total="total" :limit="limit" :page-size="limit" :on-change-page-size="onChangePageSize" />
    <div v-if="scrollMode" ref="sentinel" class="scroll-sentinel"><v-circular-progress v-if="loading && items.length > 0" indeterminate class="sm" /></div>
    <input ref="fileInput" style="display: none" type="file" accept="image/*" multiple @change="uploadChanged" />
    <input ref="dirFileInput" style="display: none" type="file" accept="image/*" multiple webkitdirectory mozdirectory directory @change="dirUploadChanged" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import toast from '@/components/toaster'
import { imagesGQL, initLazyQuery } from '@/lib/api/query'
import { getFileId, getFileUrl, getFileName } from '@/lib/api/file'
import { formatFileSize } from '@/lib/format'
import type { IImage, IImageItem } from '@/lib/interfaces'
import type { ISource } from '@/components/lightbox/types'
import { DataType, FEATURE } from '@/lib/data'
import { getImageSortItems, getImageGroupByItems, isImage } from '@/lib/file'
import { hasFeature } from '@/lib/feature'
import { storeToRefs } from 'pinia'
import { useMainStore } from '@/stores/main'
import { useGroupedScroll } from '@/hooks/grouped-scroll'
import { useMediaPage } from '@/hooks/media-page'
import ImageListItem from '@/views/images/ImageListItem.vue'
import MediaPageActions from '@/components/media/MediaPageActions.vue'
import MediaGridItem from '@/components/media/MediaGridItem.vue'
import MediaToolbar from '@/components/media/MediaToolbar.vue'
import ImageSearchButton from '@/components/ai/ImageSearchButton.vue'

const { imageSortBy } = storeToRefs(useMainStore())
const items = ref<IImageItem[]>([])
const sortItems = getImageSortItems()
const groupByItems = getImageGroupByItems()

const mp = useMediaPage({
  dataType: DataType.IMAGE, routePath: 'images',
  items, sortByRef: imageSortBy, fileFilter: isImage,
  downloadName: 'images', uploadModalId: 'upload-directory-picker-images', uploadStorageKey: 'plainweb.uploadDir.images',
  doFetch: () => fetch(), getScrollMode: () => scrollMode.value,
  setupScroll: () => setTimeout(setupSentinelObserver, 100), teardownScroll: () => teardownObserver(),
  onSort: () => { noMore.value = false },
  onBeforeFetch: () => { if (scrollMode.value) { mp.page.value = 1; noMore.value = false; items.value = [] } },
})
const {
  isPhone, mainStore, tempStore, app, urlTokenKey, noDataKey,
  filter, page, q, limit, dataType, uploadMenuVisible, moreMenuVisible,
  fileInput, dirFileInput, uploadChanged, dirUploadChanged, dropping, fileDragEnter, fileDragLeave,
  bucketsMap, addToTags, deleteItems, deleteItem, viewBucket,
  selectedIds, allChecked, realAllChecked, selectRealAll, allCheckedAlertVisible,
  clearSelection, toggleAllChecked, toggleSelect, total, checked, shiftEffectingIds, handleItemClick, shouldSelect,
  downloadItems, downloadFile, trashLoading, trash, restoreLoading, restore,
  gotoPage, onChangePageSize, getQuery, sort, handleMouseOverMode,
  openKeyboardShortcuts, addItemToTags, uploadFilesClick, uploadDirClick, dropFiles2,
} = mp

const { noMore, sentinel, isGroupMode, scrollMode, groupedItems, setupSentinelObserver, teardownObserver, prefetchNext } = useGroupedScroll({
  items, getLoading: () => loading.value, limit, page,
  doFetch: () => fetch(), getScrollPaging: () => mainStore.imagesScrollPaging, getGroupBy: () => mainStore.imagesGroupBy,
})

const effectiveIsGroupMode = computed(() => isGroupMode.value && !filter.text)

watch(() => mainStore.imagesGroupBy, () => { page.value = 1; noMore.value = false; items.value = []; fetch() })
watch(() => mainStore.imagesScrollPaging, () => { page.value = 1; items.value = []; fetch() })

const effectiveQ = computed(() => {
  const dirs = mainStore.excludedDirs
  if (!dirs.length) return q.value
  const dirParts = dirs.map((d) => (d.includes(' ') ? `excluded_dir:"${d}"` : `excluded_dir:${d}`))
  return [q.value, ...dirParts].filter(Boolean).join(' ')
})

const { loading, fetch } = initLazyQuery({
  handle: async (data: { images: IImage[]; imageCount: number }, error: string) => {
    mp.sorting.value = false
    if (error) { toast(mp.q.value, 'error') } else if (data) {
      const list = data.images.map((it) => ({ ...it, fileId: getFileId(urlTokenKey.value, it.path, it.id) }))
      if (scrollMode.value && page.value > 1) {
        const existingIds = new Set(items.value.map((i) => i.id))
        items.value = items.value.concat(list.filter((i) => !existingIds.has(i.id)))
      } else { items.value = list }
      total.value = data.imageCount
      if (scrollMode.value) { noMore.value = list.length < limit.value; prefetchNext() }
    }
  },
  document: imagesGQL,
  variables: () => ({ offset: (page.value - 1) * limit.value, limit: limit.value, query: effectiveQ.value, sortBy: effectiveIsGroupMode.value ? 'TAKEN_AT_DESC' : imageSortBy.value }),
})

const sources = computed<ISource[]>(() => items.value.map((it: IImageItem) => ({
  src: getFileUrl(it.fileId), name: getFileName(it.path), duration: 0, size: it.size, path: it.path, type: dataType, data: it,
})) as ISource[])
function view(index: number) { tempStore.lightbox = { sources: sources.value, index, visible: true } }

const actionsProps = computed(() => ({
  filterTrash: !!filter.trash, isPhone: isPhone.value, checked: checked.value,
  uploadMenuVisible: uploadMenuVisible.value, moreMenuVisible: moreMenuVisible.value,
  sortBy: imageSortBy.value, sortItems, showViewToggle: true, cardView: mainStore.imagesCardView,
  hideViewToggle: isGroupMode.value, onSort: sort, showViewOptions: true, showGroupBy: true,
  groupByItems, groupBy: mainStore.imagesGroupBy, scrollPaging: mainStore.imagesScrollPaging,
  onOpenKeyboardShortcuts: openKeyboardShortcuts, onUpdateCardView: (v: boolean) => { mainStore.imagesCardView = v },
  'onUpdate:uploadMenuVisible': (v: boolean) => { uploadMenuVisible.value = v },
  'onUpdate:moreMenuVisible': (v: boolean) => { moreMenuVisible.value = v },
  'onUpdate:groupBy': (v: string) => { mainStore.imagesGroupBy = v },
  'onUpdate:scrollPaging': (v: boolean) => { mainStore.imagesScrollPaging = v },
}))
</script>

