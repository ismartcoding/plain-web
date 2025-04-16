<template>
  <Teleport to="body">
    <div v-if="isActive" :class="['v-toast', type]" role="alert" @mouseover="toggleTimer(true)" @mouseleave="toggleTimer(false)" @click="click">
      {{ message }}
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Timer from './timer'

const props = defineProps({
  message: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    default: '',
  },
  duration: {
    type: [Number, Boolean],
    default: 3000,
  },
  onClick: {
    type: Function,
    default: () => {},
  },
})

const isActive = ref(true)

const timer = props.duration !== false ? new Timer(close, props.duration as number) : null

function click() {
  props.onClick.apply(null, arguments)
  close()
}

function toggleTimer(newVal: boolean) {
  if (timer) {
    newVal ? timer.pause() : timer.resume()
  }
}

function stopTimer() {
  timer && timer.stop()
}

function close() {
  stopTimer()
  isActive.value = false
}
</script>
