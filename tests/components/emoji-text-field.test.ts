import { createApp, h, nextTick, ref } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import EmojiTextField from '@/components/EmojiTextField.vue'
import VTextField from '@/components/base/VTextField.vue'

function mountField() {
  const modelValue = ref('')
  const keydowns = ref(0)
  const root = document.createElement('div')
  document.body.append(root)

  const app = createApp({
    setup() {
      return () => h(EmojiTextField, {
        modelValue: modelValue.value,
        type: 'textarea',
        'onUpdate:modelValue': (value: string) => { modelValue.value = value },
        onKeydown: () => { keydowns.value += 1 },
      })
    },
  })
  app.component('VTextField', VTextField)
  app.config.globalProperties.$t = (key: string) => key
  app.mount(root)

  return { app, root, modelValue, keydowns }
}

const mountedApps: ReturnType<typeof mountField>[] = []

afterEach(() => {
  for (const mounted of mountedApps.splice(0)) {
    mounted.app.unmount()
    mounted.root.remove()
  }
})

async function setValue(textarea: HTMLTextAreaElement, value: string) {
  textarea.value = value
  textarea.setSelectionRange(value.length, value.length)
  textarea.dispatchEvent(new Event('input', { bubbles: true }))
  await nextTick()
}

describe('EmojiTextField', () => {
  it('opens suggestions and inserts the active emoji with Enter', async () => {
    const mounted = mountField()
    mountedApps.push(mounted)
    const textarea = mounted.root.querySelector('textarea')!

    await setValue(textarea, ':smi')

    expect(mounted.root.querySelector('[role="listbox"]')).not.toBeNull()
    expect(mounted.root.querySelector('.emoji-suggestion-shortcode')?.textContent).toBe(':smile:')

    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    await nextTick()

    expect(mounted.modelValue.value).toBe('😄')
    expect(mounted.root.querySelector('[role="listbox"]')).toBeNull()
    expect(mounted.keydowns.value).toBe(0)
  })

  it('converts a completed shortcode as it is typed', async () => {
    const mounted = mountField()
    mountedApps.push(mounted)
    const textarea = mounted.root.querySelector('textarea')!
    await setValue(textarea, 'Celebrate :tada:')

    expect(mounted.modelValue.value).toBe('Celebrate 🎉')
  })

  it('passes Enter through when no emoji menu is open', async () => {
    const mounted = mountField()
    mountedApps.push(mounted)
    const textarea = mounted.root.querySelector('textarea')!
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    await nextTick()

    expect(mounted.keydowns.value).toBe(1)
  })

  it('passes modified Enter through instead of selecting an emoji', async () => {
    const mounted = mountField()
    mountedApps.push(mounted)
    const textarea = mounted.root.querySelector('textarea')!
    await setValue(textarea, ':smi')

    textarea.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    }))
    await nextTick()

    expect(mounted.modelValue.value).toBe(':smi')
    expect(mounted.keydowns.value).toBe(1)
  })
})
