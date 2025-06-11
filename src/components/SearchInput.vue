<template>
  <v-chip-set v-if="showChips">
    <div v-if="filter.text" key="filter-text">
      <v-input-chip :label="filter.text" remove-only @remove="removeText" />
    </div>
    <div v-if="filter.today" key="filter-today">
      <v-input-chip :label="$t('today')" remove-only @remove="removeToday">
        <i-material-symbols:today-outline-rounded />
      </v-input-chip>
    </div>
    <div v-if="filter.trash" key="filter-trash">
      <v-input-chip :label="$t('trash')" remove-only @remove="removeTrash">
        <i-material-symbols:delete-outline-rounded />
      </v-input-chip>
    </div>
    <v-input-chip v-for="item in filteredBuckets" :key="item.id" :label="item.name" remove-only @remove="removeBucket">
      <i-material-symbols:folder-outline-rounded />
    </v-input-chip>
    <v-input-chip v-for="item in filteredFeeds" :key="item.id" :label="item.name" remove-only @remove="removeFeed">
      <i-material-symbols:rss-feed-rounded />
    </v-input-chip>
    <v-input-chip v-for="item in filteredTypes" :key="item.id" :label="item.name" remove-only @remove="removeType">
      <i-material-symbols:category-outline-rounded />
    </v-input-chip>
    <v-input-chip v-for="item in filteredTags" :key="item.id" :label="item.name" remove-only @remove="removeTag(item)">
      <i-material-symbols:label-outline-rounded />
    </v-input-chip>
  </v-chip-set>
  <v-dropdown v-model="searchPanelVisible" :max-height="400">
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
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch, type PropType } from 'vue'
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

watch(props.filter, (newValue) => {
  copyFilter(newValue, localFilter)
}, { immediate: true, deep: true })


watch(searchPanelVisible, (isVisible) => {
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

function doSearch() {
  copyFilter(localFilter, props.filter)
  replacePath(mainStore, props.getUrl(buildQ(props.filter)))
}

function removeFeed() {
  localFilter.feedId = undefined
  doSearch()
}

function removeType() {
  localFilter.type = undefined
  doSearch()
}

function removeBucket() {
  localFilter.bucketId = undefined
  doSearch()
}

function removeTag(tag: ITag) {
  remove(localFilter.tagIds ?? [], (t) => t === tag.id)
  doSearch()
}

function removeToday() {
  localFilter.today = undefined
  doSearch()
}

function removeTrash() {
  localFilter.trash = false
  doSearch()
}

function removeText() {
  localFilter.text = undefined
  doSearch()
}

defineExpose({
  dismiss: () => {
    searchPanelVisible.value = false
  },
})
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