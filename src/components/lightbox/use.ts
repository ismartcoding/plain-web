import { ref } from 'vue'

export const useMediaViewer = () => {
  const visible = ref(false)
  const index = ref(-1)

  const view = (i: number) => {
    index.value = i
    visible.value = true
  }

  const hide = () => {
    visible.value = false
    index.value = -1
  }

  return {
    visible,
    index,
    view,
    hide,
  }
}
