<template>
  <div class="editor-view">
    <ImageEditor ref="editorRef" />
    <div v-if="loading" class="loading-overlay">
      <v-circular-progress indeterminate />
      <span class="loading-text">{{ loadingText }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import ImageEditor from '@/views/image-editor/components/ImageEditor.vue'

const route = useRoute()
const editorRef = ref<InstanceType<typeof ImageEditor> | null>(null)
const loading = ref(false)
const loadingText = ref('')

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
    loading.value = true
    try {
      let fetchUrl = src
      try {
        const u = new URL(src, window.location.origin)
        if (u.origin !== window.location.origin) {
          fetchUrl = u.pathname + u.search
        }
      } catch { /* relative URL — use as-is */ }
      loadingText.value = 'Loading image…'
      const res = await fetch(fetchUrl)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const file = new File([blob], name || 'image', { type: blob.type })
      loadingText.value = 'Opening editor…'
      await editorRef.value?.loadImage(file)
    } catch (e) {
      console.warn('[ImageEditorView] Fetch failed, trying direct URL load', e)
      try {
        await editorRef.value?.loadImageFromUrl(src)
      } catch (e2) {
        console.warn('[ImageEditorView] Failed to load image from URL', e2)
      }
    } finally {
      loading.value = false
    }
  }
})
</script>

<style scoped>
.editor-view {
  position: relative;
  height: 100%;
}

.loading-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  background: var(--md-sys-color-surface);
}

.loading-text {
  font-size: 14px;
  color: var(--md-sys-color-on-surface-variant);
}
</style>
