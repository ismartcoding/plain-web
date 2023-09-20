<template>
  <ContextSubMenu
    v-if="show"
    :items="options.items"
    :parentItem="{
      maxWidth: options.maxWidth || MenuConstOptions.defaultMaxWidth,
      minWidth: options.minWidth || MenuConstOptions.defaultMinWidth,
    }"
    :options="options"
    :z-index="options.zIndex || MenuConstOptions.defaultStartZindex"
    :globalData="globalData"
    :position="currentShowPos"
    :on-close="onChildrenClose"
    @preUpdatePos="onChildrenUpdatePos"
  />
</template>
<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref, watch, type PropType } from 'vue'
import { type ContextMenuPositionData, MenuConstOptions, type MenuOptions } from './ContextMenuDefine'

const emit = defineEmits(['update:show', 'close'])
const props = defineProps({
  options: {
    type: Object as PropType<MenuOptions>,
    default: null,
  },
  show: {
    type: Boolean,
    default: false,
  },
})

const currentShowPos = ref<ContextMenuPositionData>({ x: 0, y: 0 })
const globalData = {
  parentPosition: {
    x: 0,
    y: 0,
  },
  screenSize: {
    w: window.innerWidth,
    h: window.innerHeight,
  },
}
function updateCurrentShowPos() {
  currentShowPos.value.x = props.options.x
  currentShowPos.value.y = props.options.y
}
function close() {
  emit('update:show', false)
  emit('close')
}
function onChildrenClose(byUserClick: boolean) {
  if (byUserClick) {
    close()
  }
}
function onChildrenUpdatePos(newPos: ContextMenuPositionData) {
  currentShowPos.value.x = newPos.x
  currentShowPos.value.y = newPos.y
}

const onKeyPress = (e: Event) => {
  const evt = e as KeyboardEvent
  if (evt.key === 'Escape') {
    close()
  } 
}

onMounted(() => {
  document.addEventListener('keydown', onKeyPress)
  updateCurrentShowPos()
  setTimeout(() => {
    document.addEventListener('click', close)
    document.addEventListener('contextmenu', close)
  }, 100)
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeyPress)
  document.removeEventListener('click', close)
})

watch(
  () => props.show,
  (v: boolean) => {
    if (v) updateCurrentShowPos()
  }
)
</script>
