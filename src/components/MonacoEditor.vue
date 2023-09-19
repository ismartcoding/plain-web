<template>
  <div ref="root" class="monaco-editor" :style="style"></div>
</template>

<script setup lang="ts">
import { computed, toRefs, watch, ref, onMounted, onBeforeUnmount, type PropType, onUnmounted } from 'vue'
import '@/plugins/monacoworker'
import * as monaco from 'monaco-editor'
import emitter from '@/plugins/eventbus'

const props = defineProps({
  diffEditor: { type: Boolean, default: false },
  width: { type: [String, Number], default: '100%' },
  height: { type: [String, Number], default: '100%' },
  original: { type: String, default: '' },
  modelValue: { type: String, default: '' },
  language: { type: String, default: 'javascript' },
  actions: { type: Array as PropType<any[]>, default: () => [] },
  options: {
    type: Object,
    default() {
      return {
        fontSize: '14px',
        colorDecorators: true,
        lineHeight: 24,
        tabSize: 2,
        quickSuggestions: false,
      }
    },
  },
})

const emit = defineEmits(['update:modelValue', 'editorWillMount', 'editorDidMount'])

const { width, height } = toRefs(props)
const style: any = computed(() => {
  const fixedWidth = width.value.toString().includes('%') ? width.value : `${width.value}px`
  const fixedHeight = height.value.toString().includes('%') ? height.value : `${height.value}px`
  return {
    width: fixedWidth,
    height: fixedHeight,
    'text-align': 'left',
  }
})

let editor: any = null

onBeforeUnmount(() => {
  editor?.dispose()
})

const root = ref(null)

onMounted(() => {
  emit('editorWillMount', monaco)
  editor = monaco.editor[props.diffEditor ? 'createDiffEditor' : 'create'](root.value!, {
    value: props.modelValue,
    language: props.language,
    automaticLayout: true,
    theme: document.documentElement.classList[0] === 'dark' ? 'vs-dark' : 'vs',
    ...props.options,
  })
  props.diffEditor && _setModel(props.modelValue, props.original)
  for (const action of props.actions) {
    editor.addAction(action)
  }
  const editor2 = _getEditor()
  editor2.onDidChangeModelContent((event: any) => {
    const value = editor2.getValue()
    if (props.modelValue !== value) {
      emit('update:modelValue', value)
    }
  })
  emit('editorDidMount', editor)
})

watch(
  () => props.options,
  (current: Object) => {
    editor.updateOptions(current)
  },
  { deep: true }
)

watch(
  () => props.modelValue,
  (current: any) => {
    const editor = _getEditor()
    if (editor && editor.getValue() !== current) {
      editor.setValue(current)
    }
  }
)

watch(
  () => props.original,
  (current: any) => {
    const { original } = editor.getModel()
    original.setValue(current)
  }
)

watch(
  () => props.language,
  (current: string) => {
    if (!editor) {
      return
    }
    if (props.diffEditor) {
      const { original, modified } = editor.getModel()
      monaco.editor.setModelLanguage(original, current)
      monaco.editor.setModelLanguage(modified, current)
    } else {
      monaco.editor.setModelLanguage(editor.getModel(), current)
    }
  }
)

const codeModeChangedHandler = () => {
  monaco.editor.setTheme(document.documentElement.classList[0] === 'dark' ? 'vs-dark' : 'vs')
}

onMounted(() => {
  emitter.on('color_mode_changed', codeModeChangedHandler)
})

onUnmounted(() => {
  emitter.off('color_mode_changed', codeModeChangedHandler)
})

function _setModel(value: string, original: string) {
  const originalModel = monaco.editor.createModel(original, props.language)
  const modifiedModel = monaco.editor.createModel(value, props.language)
  editor.setModel({
    original: originalModel,
    modified: modifiedModel,
  })
}

function _getEditor() {
  if (!editor) return null
  return props.diffEditor ? editor.modifiedEditor : editor
}
</script>
