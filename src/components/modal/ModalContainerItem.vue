<template>
  <div class="modal" ref="containerRef" @mousedown="isDragging = false" @mousemove="isDragging = true"
    @mouseup="handelClick">
    <component :is="modal?.component" v-bind="modal?.props.value" :modalId="`_modal_${id}`" ref="modalRef"
      v-on="modal?.events" />
  </div>
</template>
<script setup lang="ts">
import { saveInstance } from './utils/instances'
import { ref, watch } from 'vue'
import { modalQueue } from './utils/state'
import { closeById } from './methods'
import type Modal from './utils/Modal'

const modalRef = ref(null)
const containerRef = ref(null)

const props = defineProps({
  id: Number,
})

const modal = getModalById(props.id)
function getModalById(id: number | undefined): Modal | undefined {
  return modalQueue.value.find((elem) => elem.id === id)
}

let isDragging = false
function handelClick(e: Event) {
  if (!isDragging) {
    if (e.target !== containerRef.value) return
    if (modal?.backgroundClose) {
      return closeById(modal.id, { background: true }).catch(() => { })
    }
  }
}

watch(
  () => modalRef.value,
  (newValue) => {
    saveInstance(props.id!, newValue!)
  }
)
</script>
