<template>
  <left-sidebar>
    <template #title>
      {{ $t(`page_title.${group}`) }}
    </template>
    <template #body>
      <ul class="nav">
        <li @click.prevent="all" :class="{ active: !selectedTagName && !selectedBucketId }">
          {{ $t('all') }}
        </li>
        <bucket-filter :type="type" :selected="selectedBucketId" />
      </ul>
      <tag-filter :type="type" :selected="selectedTagName" />
    </template>
  </left-sidebar>
</template>

<script setup lang="ts">
import router, { replacePath } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import { parseLocationQuery } from '@/lib/search'
import { ref, watch } from 'vue'
import { type IFilterField } from '@/lib/search'

const mainStore = useMainStore()

const group = ref('')
const type = ref('')
const selectedTagName = ref('')
const selectedBucketId = ref('')

function updateActive() {
  const route = router.currentRoute.value
  group.value = route.meta.group || '' // images, videos, audios
  type.value =
    {
      images: 'IMAGE',
      videos: 'VIDEO',
      audios: 'AUDIO',
    }[group.value] || ''

  const fields = parseLocationQuery(route.query)
  selectedTagName.value = fields.find((it: IFilterField) => it.name === 'tag')?.value ?? ''
  selectedBucketId.value = fields.find((it: IFilterField) => it.name === 'bucket_id')?.value ?? ''
}

updateActive()

watch(
  () => router.currentRoute.value.fullPath,
  () => {
    updateActive()
  }
)

function all() {
  replacePath(mainStore, `/${group.value}`)
}
</script>
