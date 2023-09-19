<template>
  <div ref="containerRef">
    <component
      :is="modal?.component"
      v-bind="modal?.props.value"
      :modalId="`_modal_${id}`"
      ref="modalRef"
      v-on="modal?.events"
    />
  </div>
</template>
<script setup lang="ts">
import { saveInstance } from './utils/instances'
import { ref, watch } from 'vue'
import { modalQueue } from './utils/state'
import type Modal from './utils/Modal'
import type { MdDialog } from '@material/web/dialog/dialog.js'

const modalRef = ref(null)
const containerRef = ref<HTMLDivElement>()

const props = defineProps({
  id: Number,
})

const modal = getModalById(props.id)
function getModalById(id: number | undefined): Modal | undefined {
  return modalQueue.value.find((elem) => elem.id === id)
}

watch(
  () => modalRef.value,
  (newValue) => {
    saveInstance(props.id!, newValue!)
    setTimeout(() => {
      if (containerRef.value) {
        ;(containerRef.value.firstChild as MdDialog).show()
      }
    }, 0)
  }
)
</script>
