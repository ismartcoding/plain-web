<template>
  <img v-if="isDir" class="svg" src="/ficons/folder.svg" draggable="false" />
  <img v-else-if="extError" class="svg" src="/ficons/default.svg" draggable="false" />
  <img v-else-if="thumbUrl && !thumbError" class="image-thumb" :src="thumbUrl" loading="lazy" draggable="false" @error="onThumbError" />
  <img v-else-if="extension" class="svg" :src="`/ficons/${extension}.svg`" draggable="false" @error="onExtError" />
  <img v-else class="svg" src="/ficons/default.svg" draggable="false" />
</template>

<script setup lang="ts">
interface Props {
  isDir: boolean
  thumbUrl: string
  extension: string
  thumbError?: boolean
  extError?: boolean
  onThumbError?: () => void
  onExtError?: () => void
}

withDefaults(defineProps<Props>(), {
  thumbError: false,
  extError: false,
  onThumbError: undefined,
  onExtError: undefined,
})
</script>
