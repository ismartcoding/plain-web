<template>
  <div ref="containerRef" style="position: relative; z-index: 2">
    <component :is="modal?.component" v-bind="modal?.props.value" ref="modalRef" :modal-id="`_modal_${id}`" v-on="modal?.events" />
  </div>
</template>
<script setup lang="ts">
import { saveInstance } from './utils/instances'
import { ref, watch } from 'vue'
import { modalQueue } from './utils/state'
import type Modal from './utils/Modal'

const modalRef = ref(null)
const containerRef = ref<HTMLDivElement>()

const props = defineProps({
  id: { type: Number, required: true },
})

const modal = getModalById(props.id)
function getModalById(id: number | undefined): Modal | undefined {
  return modalQueue.value.find((elem) => elem.id === id)
}

watch(
  () => modalRef.value,
  (newValue) => {
    saveInstance(props.id!, newValue!)
  }
)
</script>
