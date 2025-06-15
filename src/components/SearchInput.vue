<template>
  <!-- Desktop SearchFilters -->
  <SearchFilters v-if="showChips" :filter="filter" :tags="tags" :feeds="feeds" :buckets="buckets" :types="types" @filter-change="onFilterChange" />

  <!-- Desktop dropdown search -->
  <v-dropdown v-if="!isPhone" v-model="searchPanelVisible" :max-height="400">
    <template #trigger>
      <button v-tooltip="$t('search')" class="btn-icon">
        <i-material-symbols:search-rounded />
      </button>
    </template>
    <div class="filters">
      <div class="form-row">
        <v-text-field v-model="localFilter.text" :label="$t('keywords')" @keyup.enter="applySearch" />
      </div>
      <v-chip-set v-if="showToday">
        <v-filter-chip key="chip-today" :label="$t('today')" :selected="localFilter.today" @click="localFilter.today = !localFilter.today" />
      </v-chip-set>
      <v-chip-set v-if="showTrash">
        <v-filter-chip key="chip-today" :label="$t('trash')" :selected="localFilter.trash" @click="localFilter.trash = !localFilter.trash" />
      </v-chip-set>
      <template v-if="tags.length > 0">
        <label class="form-label">{{ $t('tags') }}</label>
        <v-chip-set>
          <v-filter-chip v-for="item in tags" :key="item.id" :label="item.name" :selected="localFilter.tagIds.includes(item.id)" @click="onTagSelect(item)" />
        </v-chip-set>
      </template>
      <template v-if="feeds.length > 0">
        <label class="form-label">{{ $t('page_title.feeds') }}</label>
        <v-chip-set>
          <v-filter-chip v-for="item in feeds" :key="item.id" :label="item.name" :selected="localFilter.feedId === item.id" @click="onFeedSelect(item)" />
        </v-chip-set>
      </template>
      <template v-if="buckets.length > 0">
        <label class="form-label">{{ $t('folders') }}</label>
        <v-chip-set>
          <v-filter-chip v-for="item in buckets" :key="item.id" :label="item.name" :selected="localFilter.bucketId === item.id" @click="onBucketSelect(item)" />
        </v-chip-set>
      </template>
      <template v-if="types.length > 0">
        <label class="form-label">{{ $t('types') }}</label>
        <v-chip-set>
          <v-filter-chip v-for="item in types" :key="item.id" :label="item.name" :selected="localFilter.type === item.id" @click="onTypeSelect(item)" />
        </v-chip-set>
      </template>
      <div class="buttons">
        <v-filled-button @click.stop="applySearch">
          {{ $t('search') }}
        </v-filled-button>
      </div>
    </div>
  </v-dropdown>

  <!-- Mobile search button -->
  <button v-if="isPhone" v-tooltip="$t('search')" class="btn-icon mobile-search-btn" @click="openMobileSearch">
    <i-material-symbols:search-rounded />
  </button>

  <!-- Mobile search BottomSheet -->
  <BottomSheet v-if="isPhone" v-model="mobileSearchVisible" :title="$t('search')" show-footer>
    <label class="form-label">{{ $t('keywords') }}</label>
    <v-text-field v-model="localFilter.text" @keyup.enter="applyMobileSearch" />
    <template v-if="showToday || showTrash">
      <v-chip-set>
        <v-filter-chip v-if="showToday" :label="$t('today')" :selected="localFilter.today" @click="localFilter.today = !localFilter.today" />
        <v-filter-chip v-if="showTrash" :label="$t('trash')" :selected="localFilter.trash" @click="localFilter.trash = !localFilter.trash" />
      </v-chip-set>
    </template>

    <template v-if="tags.length > 0">
      <label class="form-label">{{ $t('tags') }}</label>
      <v-chip-set>
        <v-filter-chip v-for="item in tags" :key="item.id" :label="item.name" :selected="localFilter.tagIds.includes(item.id)" @click="onTagSelect(item)" />
      </v-chip-set>
    </template>

    <template v-if="feeds.length > 0">
      <label class="form-label">{{ $t('page_title.feeds') }}</label>
      <v-chip-set>
        <v-filter-chip v-for="item in feeds" :key="item.id" :label="item.name" :selected="localFilter.feedId === item.id" @click="onFeedSelect(item)" />
      </v-chip-set>
    </template>

    <template v-if="buckets.length > 0">
      <label class="form-label">{{ $t('folders') }}</label>
      <v-chip-set>
        <v-filter-chip v-for="item in buckets" :key="item.id" :label="item.name" :selected="localFilter.bucketId === item.id" @click="onBucketSelect(item)" />
      </v-chip-set>
    </template>

    <template v-if="types.length > 0">
      <label class="form-label">{{ $t('types') }}</label>
      <v-chip-set>
        <v-filter-chip v-for="item in types" :key="item.id" :label="item.name" :selected="localFilter.type === item.id" @click="onTypeSelect(item)" />
      </v-chip-set>
    </template>

    <template #footer>
      <v-filled-button class="search-apply-btn" @click="applyMobileSearch">
        {{ $t('search') }}
      </v-filled-button>
    </template>
  </BottomSheet>
</template>

<script setup lang="ts">
import { reactive, ref, watch, type PropType } from 'vue'
import type { IBucket, IFeed, IFilter, ITag, IType } from '@/lib/interfaces'
import { remove } from 'lodash-es'
import { replacePath } from '@/plugins/router'
import { useSearch } from '@/hooks/search'
import { useMainStore } from '@/stores/main'

const { buildQ, copyFilter } = useSearch()
const mainStore = useMainStore()
const localFilter: IFilter = reactive({
  tagIds: [],
})

const props = defineProps({
  filter: {
    type: Object as PropType<IFilter>,
    required: true,
  },
  getUrl: {
    type: Function as PropType<(q: string) => string>,
    required: true,
  },
  tags: {
    type: Array as PropType<ITag[]>,
    default: () => [],
  },
  feeds: {
    type: Array as PropType<IFeed[]>,
    default: () => [],
  },
  buckets: {
    type: Array as PropType<IBucket[]>,
    default: () => [],
  },
  types: {
    type: Array as PropType<IType[]>,
    default: () => [],
  },
  showChips: {
    type: Boolean,
    default: true,
  },
  showToday: {
    type: Boolean,
    default: false,
  },
  showTrash: {
    type: Boolean,
    default: false,
  },
  isPhone: {
    type: Boolean,
    default: false,
  },
})

const searchPanelVisible = ref(false)
const mobileSearchVisible = ref(false)

watch(
  props.filter,
  (newValue) => {
    copyFilter(newValue, localFilter)
  },
  { immediate: true, deep: true }
)

watch(searchPanelVisible, (isVisible) => {
  if (isVisible) {
    copyFilter(props.filter, localFilter)
  }
})

watch(mobileSearchVisible, (isVisible) => {
  if (isVisible) {
    copyFilter(props.filter, localFilter)
  }
})

function onTagSelect(tag: ITag) {
  if (localFilter.tagIds.includes(tag.id)) {
    remove(localFilter.tagIds, (it: string) => it === tag.id)
  } else {
    localFilter.tagIds.push(tag.id)
  }
}

function onFeedSelect(feed: IFeed) {
  if (localFilter.feedId === feed.id) {
    localFilter.feedId = undefined
  } else {
    localFilter.feedId = feed.id
  }
}

function onBucketSelect(bucket: IBucket) {
  if (localFilter.bucketId === bucket.id) {
    localFilter.bucketId = undefined
  } else {
    localFilter.bucketId = bucket.id
  }
}

function onTypeSelect(type: IType) {
  if (localFilter.type === type.id) {
    localFilter.type = undefined
  } else {
    localFilter.type = type.id
  }
}

function applySearch() {
  doSearch()
  searchPanelVisible.value = false
}

function openMobileSearch() {
  mobileSearchVisible.value = true
}

function applyMobileSearch() {
  doSearch()
  mobileSearchVisible.value = false
}

function doSearch() {
  copyFilter(localFilter, props.filter)
  replacePath(mainStore, props.getUrl(buildQ(props.filter)))
}

function onFilterChange(newFilter: IFilter) {
  copyFilter(newFilter, props.filter)
  replacePath(mainStore, props.getUrl(buildQ(props.filter)))
}

defineExpose({
  dismiss: () => {
    searchPanelVisible.value = false
    mobileSearchVisible.value = false
  },
})
</script>

<style lang="scss" scoped>
/* Desktop styles */
.filters {
  padding: 16px;
  min-width: 400px;

  .buttons {
    text-align: right;
    margin-block-start: 16px;
  }
}

.form-label {
  margin-block-start: 16px;
}

.search-apply-btn {
  width: 100%;
}
</style>
