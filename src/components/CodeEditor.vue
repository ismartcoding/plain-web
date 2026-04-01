<template>
  <div ref="container" class="code-editor" />
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, shallowRef } from 'vue'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { EditorState, type Extension } from '@codemirror/state'
import { defaultKeymap, indentWithTab, history, historyKeymap } from '@codemirror/commands'
import { bracketMatching, indentOnInput, syntaxHighlighting, defaultHighlightStyle, LanguageDescription } from '@codemirror/language'
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { oneDark } from '@codemirror/theme-one-dark'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import { languages } from '@codemirror/language-data'
import emitter from '@/plugins/eventbus'

const props = defineProps<{
  modelValue: string
  language?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const container = ref<HTMLElement>()
const view = shallowRef<EditorView>()

let isDark = document.documentElement.classList.contains('dark')

const baseTheme = EditorView.theme({
  '&': { height: '100%', fontSize: '14px' },
  '.cm-scroller': { overflow: 'auto', fontFamily: "'SF Mono', 'Fira Code', 'Fira Mono', Menlo, Consolas, monospace" },
  '.cm-content': { padding: '8px 0' },
  '.cm-line': { padding: '0 12px' },
  '.cm-gutters': { backgroundColor: 'transparent', borderRight: 'none' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent' },
  '&.cm-focused': { outline: 'none' },
})

const lightTheme = EditorView.theme({
  '.cm-activeLine': { backgroundColor: 'rgba(0, 0, 0, 0.04)' },
  '.cm-selectionBackground': { backgroundColor: 'rgba(0, 120, 215, 0.2) !important' },
})

function getExtensions(langExt?: Extension): Extension[] {
  const exts: Extension[] = [
    lineNumbers(),
    history(),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    highlightSelectionMatches(),
    syntaxHighlighting(defaultHighlightStyle),
    keymap.of([...defaultKeymap, ...historyKeymap, ...closeBracketsKeymap, ...searchKeymap, indentWithTab]),
    EditorView.lineWrapping,
    EditorView.updateListener.of((update) => {
      if (update.docChanged) emit('update:modelValue', update.state.doc.toString())
    }),
    baseTheme,
  ]
  if (langExt) exts.push(langExt)
  exts.push(isDark ? oneDark : lightTheme)
  return exts
}

async function loadLanguage(name?: string): Promise<Extension | undefined> {
  if (!name) return undefined
  const desc = LanguageDescription.matchLanguageName(languages, name, true)
  if (!desc) return undefined
  await desc.load()
  return desc.support ?? undefined
}

async function createEditor() {
  if (!container.value) return
  const langExt = await loadLanguage(props.language)
  view.value = new EditorView({
    state: EditorState.create({ doc: props.modelValue, extensions: getExtensions(langExt) }),
    parent: container.value,
  })
}

function replaceTheme() {
  const v = view.value
  if (!v) return
  const doc = v.state.doc.toString()
  v.destroy()
  loadLanguage(props.language).then((langExt) => {
    view.value = new EditorView({
      state: EditorState.create({ doc, extensions: getExtensions(langExt) }),
      parent: container.value!,
    })
  })
}

onMounted(() => {
  createEditor()
  emitter.on('color_mode_changed', () => {
    isDark = document.documentElement.classList.contains('dark')
    replaceTheme()
  })
})

onUnmounted(() => {
  view.value?.destroy()
  emitter.off('color_mode_changed')
})

watch(
  () => props.modelValue,
  (val) => {
    const v = view.value
    if (!v || v.state.doc.toString() === val) return
    v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: val } })
  },
)
</script>

<style scoped>
.code-editor {
  height: 100%;
  overflow: hidden;
}
.code-editor :deep(.cm-editor) {
  height: 100%;
}
</style>
