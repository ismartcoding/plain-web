<template>
  <md-chip-set v-if="showChips">
    <div v-if="props.filter.text" key="filter-text">
      <md-input-chip :label="props.filter.text" remove-only @remove="removeText" />
    </div>
    <div v-if="props.filter.today" key="filter-today">
      <md-input-chip :label="$t('today')" remove-only @remove="removeToday">
        <i-material-symbols:today-outline-rounded slot="icon" />
      </md-input-chip>
    </div>
    <div v-if="props.filter.trash" key="filter-trash">
      <md-input-chip :label="$t('trash')" remove-only @remove="removeTrash">
        <i-material-symbols:delete-outline-rounded slot="icon" />
      </md-input-chip>
    </div>
    <md-input-chip v-for="item in filteredBuckets" :key="item.id" :label="item.name" remove-only @remove="removeBucket">
      <i-material-symbols:folder-outline-rounded slot="icon" />
    </md-input-chip>
    <md-input-chip v-for="item in filteredFeeds" :key="item.id" :label="item.name" remove-only @remove="removeFeed">
      <i-material-symbols:rss-feed-rounded slot="icon" />
    </md-input-chip>
    <md-input-chip v-for="item in filteredTypes" :key="item.id" :label="item.name" remove-only @remove="removeType">
      <i-material-symbols:category-outline-rounded slot="icon" />
    </md-input-chip>
    <md-input-chip v-for="item in filteredTags" :key="item.id" :label="item.name" remove-only @remove="removeTag(item)">
      <i-material-symbols:label-outline-rounded slot="icon" />
    </md-input-chip>
  </md-chip-set>
  <button id="btn-search" v-tooltip="$t('search')" class="btn-icon" @click.prevent="show">
    <md-ripple />
    <i-material-symbols:search-rounded />
  </button>
  <md-menu positioning="popover" anchor="btn-search" menu-corner="start-end" anchor-corner="end-end" stay-open-on-focusout quick :open="searchPanelVisible" @closed="hide">
    <div class="filters">
      <div class="form-row">
        <md-outlined-text-field v-model="searchFilter.text" :label="$t('keywords')" @keyup.enter="applyAndDoSearch" />
      </div>
      <md-chip-set v-if="props.showToday">
        <md-filter-chip key="chip-today" :label="$t('today')" :selected="searchFilter.today" @click="searchFilter.today = !searchFilter.today" />
      </md-chip-set>
      <md-chip-set v-if="props.showTrash">
        <md-filter-chip key="chip-today" :label="$t('trash')" :selected="searchFilter.trash" @click="searchFilter.trash = !searchFilter.trash" />
      </md-chip-set>
      <template v-if="props.tags.length > 0">
        <label class="form-label">{{ $t('tags') }}</label>
        <md-chip-set>
          <md-filter-chip v-for="item in tags" :key="item.id" :label="item.name" :selected="searchFilter.tagIds.includes(item.id)" @click="onTagSelect(item)" />
        </md-chip-set>
      </template>
      <template v-if="props.feeds.length > 0">
        <label class="form-label">{{ $t('page_title.feeds') }}</label>
        <md-chip-set>
          <md-filter-chip v-for="item in feeds" :key="item.id" :label="item.name" :selected="searchFilter.feedId === item.id" @click="onFeedSelect(item)" />
        </md-chip-set>
      </template>
      <template v-if="props.buckets.length > 0">
        <label class="form-label">{{ $t('folders') }}</label>
        <md-chip-set>
          <md-filter-chip v-for="item in buckets" :key="item.id" :label="item.name" :selected="searchFilter.bucketId === item.id" @click="onBucketSelect(item)" />
        </md-chip-set>
      </template>
      <template v-if="props.types.length > 0">
        <label class="form-label">{{ $t('types') }}</label>
        <md-chip-set>
          <md-filter-chip v-for="item in types" :key="item.id" :label="item.name" :selected="searchFilter.type === item.id" @click="onTypeSelect(item)" />
        </md-chip-set>
      </template>
      <div class="buttons">
        <md-filled-button @click.stop="applyAndDoSearch">
          {{ $t('search') }}
        </md-filled-button>
      </div>
    </div>
  </md-menu>
</template>

<script setup lang="ts">
import { computed, reactive, ref, type PropType } from 'vue'
import type { IBucket, IFeed, IFilter, ITag, IType } from '@/lib/interfaces'
import { remove } from 'lodash-es'
import { replacePath } from '@/plugins/router'
import { useSearch } from '@/hooks/search'
import { useMainStore } from '@/stores/main'

const { copyFilter, buildQ } = useSearch()
const mainStore = useMainStore()
const searchFilter: IFilter = reactive({
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
})
const filteredTags = computed(() => {
  return (props.tags ?? []).filter((t) => props.filter.tagIds?.includes(t.id))
})

const filteredFeeds = computed(() => {
  return (props.feeds ?? []).filter((t) => props.filter.feedId === t.id)
})

const filteredBuckets = computed(() => {
  return (props.buckets ?? []).filter((t) => props.filter.bucketId === t.id)
})

const filteredTypes = computed(() => {
  return (props.types ?? []).filter((t) => props.filter.type === t.id)
})

const searchPanelVisible = ref(false)

function onTagSelect(tag: ITag) {
  if (searchFilter.tagIds.includes(tag.id)) {
    remove(searchFilter.tagIds, (it: string) => it === tag.id)
  } else {
    searchFilter.tagIds.push(tag.id)
  }
}

function onFeedSelect(feed: IFeed) {
  if (searchFilter.feedId === feed.id) {
    searchFilter.feedId = undefined
  } else {
    searchFilter.feedId = feed.id
  }
}

function onBucketSelect(bucket: IBucket) {
  if (searchFilter.bucketId === bucket.id) {
    searchFilter.bucketId = undefined
  } else {
    searchFilter.bucketId = bucket.id
  }
}

function onTypeSelect(type: IType) {
  if (searchFilter.type === type.id) {
    searchFilter.type = undefined
  } else {
    searchFilter.type = type.id
  }
}

function applyAndDoSearch() {
  copyFilter(searchFilter, props.filter)
  doSearch()
  hide()
}

function doSearch() {
  replacePath(mainStore, props.getUrl(buildQ(props.filter)))
}

function removeFeed() {
  props.filter.feedId = undefined
  doSearch()
}

function removeType() {
  props.filter.type = undefined
  doSearch()
}

function removeBucket() {
  props.filter.bucketId = undefined
  doSearch()
}

function removeTag(tag: ITag) {
  remove(props.filter.tagIds ?? [], (t) => t === tag.id)
  doSearch()
}

function removeToday() {
  props.filter.today = undefined
  doSearch()
}

function removeTrash() {
  props.filter.trash = false
  doSearch()
}

function removeText() {
  props.filter.text = undefined
  doSearch()
}

function show() {
  searchPanelVisible.value = true
  copyFilter(props.filter, searchFilter)
}

function hide() {
  searchPanelVisible.value = false
}

defineExpose({ dismiss: hide })
</script>
<style lang="scss" scoped>
.filters {
  padding: 16px;
  min-width: 400px;

  md-outlined-text-field {
    width: 100%;
  }

  .buttons {
    text-align: right;
    margin-block-start: 16px;
  }

  .form-label {
    margin-block-start: 16px;
    margin-block-end: 8px;
  }
}
</style>
