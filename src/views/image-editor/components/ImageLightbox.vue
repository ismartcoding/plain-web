<template>
  <Teleport to="body">
    <Transition name="lightbox">
      <div v-if="modelValue" class="lightbox" @click.self="close">
        <button class="overlay-btn close-btn" :title="$t('image_editor.close')" @click="close">
          <i-lucide-x />
        </button>

        <div class="image-wrap">
          <img
            v-for="(img, i) in images"
            v-show="i === currentIndex"
            :key="i"
            :src="img.src"
            :alt="img.label"
            class="lightbox-img"
            draggable="false"
          />
        </div>

        <div v-if="images.length > 1" class="nav prev" @click="prev">
          <i-lucide-chevron-left />
        </div>
        <div v-if="images.length > 1" class="nav next" @click="next">
          <i-lucide-chevron-right />
        </div>

        <div v-if="currentImage.label" class="caption">
          {{ currentImage.label }}
          <template v-if="images.length > 1"> · {{ currentIndex + 1 }}/{{ images.length }}</template>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

export interface LightboxImage {
  src: string
  label: string
}

const props = defineProps<{
  modelValue: boolean
  images: LightboxImage[]
  startIndex?: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const currentIndex = ref(props.startIndex ?? 0)

const currentImage = computed(() => props.images[currentIndex.value] ?? { src: '', label: '' })

watch(() => props.modelValue, (open) => {
  if (open && props.startIndex !== undefined) currentIndex.value = props.startIndex
})

function close() { emit('update:modelValue', false) }
function prev() { currentIndex.value = (currentIndex.value - 1 + props.images.length) % props.images.length }
function next() { currentIndex.value = (currentIndex.value + 1) % props.images.length }

function onKey(e: KeyboardEvent) {
  if (!props.modelValue) return
  if (e.key === 'Escape') close()
  else if (e.key === 'ArrowLeft') prev()
  else if (e.key === 'ArrowRight') next()
}

onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<style lang="scss" scoped>
.lightbox {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0, 0, 0, 0.88);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.image-wrap {
  max-width: 100%;
  max-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.lightbox-img {
  max-width: 90vw;
  max-height: 90vh;
  object-fit: contain;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
}

.overlay-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  cursor: pointer;
  font-size: 20px;
  z-index: 10;
  transition: background 0.15s;

  &:hover { background: rgba(255, 255, 255, 0.2); }
}

.nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  cursor: pointer;
  font-size: 24px;
  z-index: 10;
  transition: background 0.15s;

  &:hover { background: rgba(255, 255, 255, 0.2); }
  &.prev { left: 16px; }
  &.next { right: 16px; }
}

.caption {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  max-width: 80%;
  padding: 6px 14px;
  background: rgba(0, 0, 0, 0.4);
  color: rgba(255, 255, 255, 0.85);
  font-size: 12px;
  font-weight: 500;
  border-radius: 999px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lightbox-enter-active { transition: opacity 0.3s cubic-bezier(0.22, 1, 0.36, 1); }
.lightbox-leave-active { transition: opacity 0.2s cubic-bezier(0.4, 0, 1, 1); }
.lightbox-enter-from, .lightbox-leave-to { opacity: 0; }
</style>
