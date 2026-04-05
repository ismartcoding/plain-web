<template>
  <div ref="editorContainer" class="markdown-editor" @paste="handlePaste" @drop.prevent="handleDrop" @dragover.prevent />
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, shallowRef } from 'vue'
import { EditorView, keymap, placeholder as cmPlaceholder, lineNumbers, ViewPlugin, Decoration, type DecorationSet } from '@codemirror/view'
import { EditorState, type Extension, RangeSetBuilder } from '@codemirror/state'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { defaultKeymap, indentWithTab, history, historyKeymap } from '@codemirror/commands'
import { bracketMatching, indentOnInput, syntaxHighlighting, defaultHighlightStyle, syntaxTree } from '@codemirror/language'
import { closeBrackets, closeBracketsKeymap, autocompletion, type CompletionContext, type Completion } from '@codemirror/autocomplete'
import { oneDark } from '@codemirror/theme-one-dark'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import emitter from '@/plugins/eventbus'

const props = defineProps<{
  modelValue: string
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'paste-images': [files: File[]]
}>()

const editorContainer = ref<HTMLElement>()
const view = shallowRef<EditorView>()

const lightTheme = EditorView.theme({
  '&': { height: '100%', fontSize: '14px' },
  '.cm-scroller': { overflow: 'auto', fontFamily: "'SF Mono', 'Fira Code', 'Fira Mono', Menlo, Consolas, monospace" },
  '.cm-content': { padding: '8px 0' },
  '.cm-line': { padding: '0 12px' },
  '.cm-gutters': { backgroundColor: 'transparent', borderRight: 'none' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent' },
  '&.cm-focused': { outline: 'none' },
  '.cm-activeLine': { backgroundColor: 'rgba(0, 0, 0, 0.04)' },
  '.cm-selectionBackground': { backgroundColor: 'rgba(0, 120, 215, 0.2) !important' },
})

const darkThemeOverride = EditorView.theme({
  '&': { height: '100%', fontSize: '14px' },
  '.cm-scroller': { overflow: 'auto', fontFamily: "'SF Mono', 'Fira Code', 'Fira Mono', Menlo, Consolas, monospace" },
  '.cm-content': { padding: '8px 0' },
  '.cm-line': { padding: '0 12px' },
  '.cm-gutters': { backgroundColor: 'transparent', borderRight: 'none' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent' },
  '&.cm-focused': { outline: 'none' },
})

const mdHeadingClasses: Record<string, Decoration> = {
  ATXHeading1: Decoration.mark({ class: 'cm-md-h1' }),
  ATXHeading2: Decoration.mark({ class: 'cm-md-h2' }),
  ATXHeading3: Decoration.mark({ class: 'cm-md-h3' }),
  ATXHeading4: Decoration.mark({ class: 'cm-md-h4' }),
}

function buildMdDecos(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from, to,
      enter(node) {
        const deco = mdHeadingClasses[node.name]
        if (deco) builder.add(node.from, node.to, deco)
      },
    })
  }
  return builder.finish()
}

const mdHeadingPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) { this.decorations = buildMdDecos(view) }
    update(update: { docChanged: boolean; viewportChanged: boolean; view: EditorView }) {
      if (update.docChanged || update.viewportChanged) this.decorations = buildMdDecos(update.view)
    }
  },
  { decorations: (v) => v.decorations },
)

const mdHeadingTheme = EditorView.theme({
  '.cm-md-h1': { fontWeight: 'bold', fontSize: '1.6em' },
  '.cm-md-h2': { fontWeight: 'bold', fontSize: '1.4em' },
  '.cm-md-h3': { fontWeight: 'bold', fontSize: '1.2em' },
  '.cm-md-h4': { fontWeight: 'bold', fontSize: '1.1em' },
})

function mdCompletions(context: CompletionContext) {
  const before = context.matchBefore(/[#\-\*\!\[\`\|>]?[\w]*/)
  if (!before || (before.from === before.to && !context.explicit)) return null
  const word = before.text.toLowerCase()
  const snippets: Completion[] = [
    { label: '# ', displayLabel: '# Heading 1', type: 'keyword', apply: '# ', detail: 'H1' },
    { label: '## ', displayLabel: '## Heading 2', type: 'keyword', apply: '## ', detail: 'H2' },
    { label: '### ', displayLabel: '### Heading 3', type: 'keyword', apply: '### ', detail: 'H3' },
    { label: '**bold**', type: 'keyword', apply: '**bold**', detail: 'Bold' },
    { label: '*italic*', type: 'keyword', apply: '*italic*', detail: 'Italic' },
    { label: '~~strike~~', type: 'keyword', apply: '~~strikethrough~~', detail: 'Strikethrough' },
    { label: '```code```', displayLabel: '``` Code Block', type: 'keyword', apply: '```\n\n```', detail: 'Code block' },
    { label: '`inline`', type: 'keyword', apply: '`code`', detail: 'Inline code' },
    { label: '- [ ] ', displayLabel: '- [ ] Task', type: 'keyword', apply: '- [ ] ', detail: 'Task item' },
    { label: '- list', type: 'keyword', apply: '- ', detail: 'Unordered list' },
    { label: '1. list', type: 'keyword', apply: '1. ', detail: 'Ordered list' },
    { label: '> quote', type: 'keyword', apply: '> ', detail: 'Blockquote' },
    { label: '---', type: 'keyword', apply: '---\n', detail: 'Horizontal rule' },
    { label: '![image](url)', type: 'keyword', apply: '![alt](url)', detail: 'Image' },
    { label: '[link](url)', type: 'keyword', apply: '[text](url)', detail: 'Link' },
    { label: '| table |', type: 'keyword', apply: '| Header | Header |\n| ------ | ------ |\n| Cell   | Cell   |', detail: 'Table' },
    { label: '[^footnote]', type: 'keyword', apply: '[^1]: ', detail: 'Footnote' },
    { label: '$math$', type: 'keyword', apply: '$expression$', detail: 'Inline math' },
    { label: '$$math$$', type: 'keyword', apply: '$$\nexpression\n$$', detail: 'Math block' },
  ]
  const filtered = word ? snippets.filter((s) => s.label.toLowerCase().includes(word) || (s.detail ?? '').toLowerCase().includes(word)) : snippets
  if (filtered.length === 0) return null
  return { from: before.from, options: filtered, validFor: /.*/ }
}

let isDark = document.documentElement.classList.contains('dark')

function getExtensions(): Extension[] {
  const exts: Extension[] = [
    lineNumbers(),
    history(),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    highlightSelectionMatches(),
    markdown({ base: markdownLanguage, codeLanguages: languages }),
    autocompletion({ override: [mdCompletions], activateOnTyping: true }),
    syntaxHighlighting(defaultHighlightStyle),
    mdHeadingPlugin,
    mdHeadingTheme,
    keymap.of([...defaultKeymap, ...historyKeymap, ...closeBracketsKeymap, ...searchKeymap, indentWithTab]),
    EditorView.lineWrapping,
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        emit('update:modelValue', update.state.doc.toString())
      }
    }),
  ]
  if (props.placeholder) exts.push(cmPlaceholder(props.placeholder))
  exts.push(isDark ? oneDark : lightTheme, isDark ? darkThemeOverride : lightTheme)
  return exts
}

function createEditor() {
  if (!editorContainer.value) return
  view.value = new EditorView({
    state: EditorState.create({ doc: props.modelValue, extensions: getExtensions() }),
    parent: editorContainer.value,
  })
}

function handlePaste(e: ClipboardEvent) {
  const items = e.clipboardData?.items
  if (!items) return
  const images: File[] = []
  for (const item of items) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (file) images.push(file)
    }
  }
  if (images.length > 0) {
    e.preventDefault()
    emit('paste-images', images)
  }
}

function handleDrop(e: DragEvent) {
  const files = e.dataTransfer?.files
  if (!files) return
  const images: File[] = []
  for (const file of files) {
    if (file.type.startsWith('image/')) images.push(file)
  }
  if (images.length > 0) emit('paste-images', images)
}

function insertText(text: string) {
  const v = view.value
  if (!v) return
  const { from } = v.state.selection.main
  v.dispatch({ changes: { from, insert: text }, selection: { anchor: from + text.length } })
  v.focus()
}

function replaceTheme() {
  const v = view.value
  if (!v) return
  const doc = v.state.doc.toString()
  v.destroy()
  view.value = new EditorView({
    state: EditorState.create({ doc, extensions: getExtensions() }),
    parent: editorContainer.value!,
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

// Sync external value changes (e.g., loading from server)
watch(
  () => props.modelValue,
  (val) => {
    const v = view.value
    if (!v || v.state.doc.toString() === val) return
    v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: val } })
  },
)

defineExpose({ insertText })
</script>

<style scoped>
.markdown-editor {
  height: 100%;
  overflow: hidden;
}
.markdown-editor :deep(.cm-editor) {
  height: 100%;
}
</style>
