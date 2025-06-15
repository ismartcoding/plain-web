<template>
  <v-chip-set v-if="filter.text || filter.today || filter.trash || filteredBuckets.length || filteredFeeds.length || filteredTypes.length || filteredTags.length">
    <v-input-chip v-if="filter.text" key="filter-text" :label="filter.text" remove-only @remove="removeText" />
    <v-input-chip v-if="filter.today" key="filter-today" :label="$t('today')" remove-only @remove="removeToday">
      <i-material-symbols:today-outline-rounded />
    </v-input-chip>
    <v-input-chip v-if="filter.trash" key="filter-trash" :label="$t('trash')" remove-only @remove="removeTrash">
      <i-material-symbols:delete-outline-rounded />
    </v-input-chip>
    <v-input-chip v-for="item in filteredBuckets" :key="item.id" :label="item.name" remove-only @remove="removeBucket">
      <i-material-symbols:folder-outline-rounded />
    </v-input-chip>
    <v-input-chip v-for="item in filteredFeeds" :key="item.id" :label="item.name" remove-only @remove="removeFeed">
      <i-material-symbols:rss-feed-rounded />
    </v-input-chip>
    <v-input-chip v-for="item in filteredTypes" :key="item.id" :label="item.name" remove-only @remove="removeType">
      <i-material-symbols:category-outline-rounded />
    </v-input-chip>
    <v-input-chip v-for="item in filteredTags" :key="item.id" :label="item.name" remove-only @remove="() => removeTag(item)">
      <i-material-symbols:label-outline-rounded />
    </v-input-chip>
  </v-chip-set>
</template>

<script setup lang="ts">
import { computed, type PropType } from 'vue'
import type { IBucket, IFeed, IFilter, ITag, IType } from '@/lib/interfaces'

const props = defineProps({
  filter: {
    type: Object as PropType<IFilter>,
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
})

const emit = defineEmits<{
  filterChange: [filter: IFilter]
}>()

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

function removeText() {
  const newFilter = { ...props.filter }
  newFilter.text = undefined
  emit('filterChange', newFilter)
}

function removeToday() {
  const newFilter = { ...props.filter }
  newFilter.today = undefined
  emit('filterChange', newFilter)
}

function removeTrash() {
  const newFilter = { ...props.filter }
  newFilter.trash = false
  emit('filterChange', newFilter)
}

function removeBucket() {
  const newFilter = { ...props.filter }
  newFilter.bucketId = undefined
  emit('filterChange', newFilter)
}

function removeFeed() {
  const newFilter = { ...props.filter }
  newFilter.feedId = undefined
  emit('filterChange', newFilter)
}

function removeType() {
  const newFilter = { ...props.filter }
  newFilter.type = undefined
  emit('filterChange', newFilter)
}

function removeTag(tag: ITag) {
  const newFilter = { ...props.filter }
  if (newFilter.tagIds) {
    newFilter.tagIds = newFilter.tagIds.filter((id) => id !== tag.id)
  }
  emit('filterChange', newFilter)
}
</script>
