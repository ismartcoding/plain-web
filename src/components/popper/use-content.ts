import { ref, onMounted, onBeforeUnmount, watch } from 'vue'

export default function useContent(slots: { content: undefined }, popperNode: { value: Node }, content: { value: any }) {
  let observer: MutationObserver | null = null
  const hasContent = ref(false)

  onMounted(() => {
    if (slots.content !== undefined || content.value) {
      hasContent.value = true
    }

    observer = new MutationObserver(checkContent)
    observer.observe(popperNode.value, {
      childList: true,
      subtree: true,
    })
  })

  onBeforeUnmount(() => observer?.disconnect())

  watch(content, (content) => {
    if (content) {
      hasContent.value = true
    } else {
      hasContent.value = false
    }
  })

  const checkContent = () => {
    if (slots.content) {
      hasContent.value = true
    } else {
      hasContent.value = false
    }
  }

  return {
    hasContent,
  }
}
