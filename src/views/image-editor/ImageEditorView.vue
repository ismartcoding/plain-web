<template>
  <ImageEditor ref="editorRef" />
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import ImageEditor from '@/views/image-editor/components/ImageEditor.vue'

const route = useRoute()
const editorRef = ref<InstanceType<typeof ImageEditor> | null>(null)

onMounted(async () => {
  const blank = route.query.blank as string | undefined
  const src = route.query.src as string | undefined
  const name = route.query.name as string | undefined
  await nextTick()
  if (blank) {
    editorRef.value?.startBlank()
    return
  }
  if (src) {
    try {
      const res = await fetch(src)
      const blob = await res.blob()
      const file = new File([blob], name || 'image', { type: blob.type })
      editorRef.value?.loadImage(file)
    } catch (e) {
      console.warn('[ImageEditorView] Failed to load image', e)
    }
  }
})
</script>
