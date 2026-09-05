<template>
  <div ref="editorContainer" class="markdown-editor" @paste="handlePaste" @drop.prevent="handleDrop" @dragover.prevent @contextmenu="onContextMenu">
    <div v-if="slashOpen" class="slash-menu" :style="slashStyle" @mousedown.prevent>
      <div
        v-for="(it, i) in slashFiltered"
        :key="it.id"
        class="slash-item"
        :class="{ hot: i === slashActive }"
        @click="applySlash(i)"
        @mousemove="slashActive = i"
      >
        <span class="slash-ic">{{ it.icon }}</span>
        <span class="slash-label">{{ $t(`md_${it.id}`) }}</span>
        <span class="slash-kbd">{{ it.kbd }}</span>
      </div>
    </div>
    <div v-if="selBarOpen" class="sel-toolbar" :style="selBarStyle" @mousedown.prevent>
      <button class="st-btn" :aria-label="$t('md_bold')" @click="runCmd(toggleWrap, '**')"><b>B</b></button>
      <button class="st-btn" :aria-label="$t('md_italic')" @click="runCmd(toggleWrap, '*')"><i>I</i></button>
      <button class="st-btn" :aria-label="$t('md_strike')" @click="runCmd(toggleWrap, '~~')"><s>S</s></button>
      <button class="st-btn" :aria-label="$t('md_inline_code')" @click="runCmd(toggleWrap, '`')">&lt;&gt;</button>
      <button class="st-btn" :aria-label="$t('md_link')" @click="runCmd(toggleLink)">🔗</button>
      <span class="st-div"></span>
      <button class="st-btn" :aria-label="$t('md_h1')" @click="runCmd(cycleHeading)">H</button>
      <button class="st-btn" :aria-label="$t('md_ul')" @click="runCmd(togglePrefix, '- ')">•</button>
      <button class="st-btn" :aria-label="$t('md_task')" @click="runCmd(togglePrefix, '- [ ] ')">☑</button>
      <button class="st-btn" :aria-label="$t('md_quote')" @click="runCmd(togglePrefix, '> ')">❝</button>
    </div>
    <div class="fmt-bar">
      <button class="fb" :aria-label="$t('md_h1')" @mousedown.prevent @click="runCmd(cycleHeading)">H</button>
      <button class="fb" :aria-label="$t('md_bold')" @mousedown.prevent @click="runCmd(toggleWrap, '**')"><b>B</b></button>
      <button class="fb" :aria-label="$t('md_italic')" @mousedown.prevent @click="runCmd(toggleWrap, '*')"><i>I</i></button>
      <button class="fb" :aria-label="$t('md_strike')" @mousedown.prevent @click="runCmd(toggleWrap, '~~')"><s>S</s></button>
      <button class="fb" :aria-label="$t('md_task')" @mousedown.prevent @click="runCmd(togglePrefix, '- [ ] ')">☑</button>
      <button class="fb" :aria-label="$t('md_ul')" @mousedown.prevent @click="runCmd(togglePrefix, '- ')">•</button>
      <button class="fb" :aria-label="$t('md_inline_code')" @mousedown.prevent @click="runCmd(toggleWrap, '`')">&lt;&gt;</button>
      <button class="fb" :aria-label="$t('md_quote')" @mousedown.prevent @click="runCmd(togglePrefix, '> ')">❝</button>
      <button class="fb" :aria-label="$t('md_table')" @mousedown.prevent @click="insertTable">▦</button>
      <button class="fb" :aria-label="$t('md_image')" @mousedown.prevent @click="runCmd(insertImageAtCursor)">img</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, computed, onMounted, onUnmounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { EditorView, keymap, placeholder as cmPlaceholder, ViewPlugin, Decoration, WidgetType, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import { EditorState, type Extension, RangeSet, type Range } from '@codemirror/state'
import type { SyntaxNodeRef } from '@lezer/common'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { defaultKeymap, indentWithTab, history, historyKeymap, undo, redo } from '@codemirror/commands'
import { bracketMatching, indentOnInput, syntaxHighlighting, defaultHighlightStyle, syntaxTree, HighlightStyle } from '@codemirror/language'
import { tags as highlightTags } from '@lezer/highlight'
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { oneDark } from '@codemirror/theme-one-dark'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import emitter from '@/plugins/eventbus'
import { i18n } from '@/plugins/i18n'
import { useTempStore } from '@/stores/temp'
import { getFileUrlByPath } from '@/lib/api/file'
import { useOpenMedia } from '@/hooks/open-media'
import { contextmenu } from '@/components/contextmenu'
import type { MenuItem } from '@/components/contextmenu/ContextMenuDefine'
import { DataType } from '@/lib/data'
import {
  SLASH_TEMPLATES,
  matchSlashQuery,
  filterSlashTemplates,
  applyTemplate,
  toggleWrap,
  togglePrefix,
  cycleHeading,
  toggleLink,
  insertImageAtCursor,
  parseGfmTable,
  findMathSpans,
  type GfmTable,
  type SlashTemplate,
} from '@/lib/md-editor'
import katex from 'katex'

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

const { app, urlTokenKey } = storeToRefs(useTempStore())
const { open: openMedia } = useOpenMedia()

const isMobileViewport = () => window.matchMedia('(max-width: 768px)').matches

function resolveImageUrl(link: string): string {
  if (link.startsWith('app://')) {
    return getFileUrlByPath(urlTokenKey.value, app.value.appDir + '/' + link.replace('app://', ''))
  }
  if (link.startsWith('fid:')) {
    return getFileUrlByPath(urlTokenKey.value, link)
  }
  return link
}

function zoomImage(link: string) {
  openMedia(0, [{
    src: resolveImageUrl(link),
    path: link.replace(/^app:\/\//, ''),
    name: decodeURIComponent(link.split('/').pop() ?? 'image'),
    size: 0,
    duration: 0,
    type: DataType.IMAGE,
  }], true)
}

function runCmd(fn: (v: EditorView, ...args: never[]) => void, ...args: unknown[]) {
  const v = view.value
  if (!v) return
  ;(fn as (v: EditorView, ...a: unknown[]) => void)(v, ...args)
  v.focus()
}

function insertTable() {
  const v = view.value
  const table = SLASH_TEMPLATES.find((t) => t.id === 'table')
  if (!v || !table) return
  applyTemplate(v, table)
  v.focus()
}

class CheckboxWidget extends WidgetType {
  constructor(readonly checked: boolean, readonly pos: number, readonly cmView: EditorView) {
    super()
  }
  eq(other: CheckboxWidget) {
    return other.checked === this.checked
  }
  toDOM() {
    const box = document.createElement('span')
    box.className = 'cm-md-task-box' + (this.checked ? ' checked' : '')
    box.setAttribute('role', 'checkbox')
    box.setAttribute('aria-checked', String(this.checked))
    box.textContent = this.checked ? '✓' : ''
    box.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.cmView.dispatch({
        changes: { from: this.pos, to: this.pos + 3, insert: this.checked ? '[ ]' : '[x]' },
        selection: { anchor: this.pos + 3 },
      })
      this.cmView.focus()
    })
    return box
  }
  ignoreEvent() {
    return false
  }
}

class ImageWidget extends WidgetType {
  constructor(readonly link: string, readonly alt: string) {
    super()
  }
  eq(other: ImageWidget) {
    return other.link === this.link && other.alt === this.alt
  }
  toDOM() {
    const fig = document.createElement('span')
    fig.className = 'cm-md-img'
    fig.dataset.link = this.link
    const img = document.createElement('img')
    img.src = resolveImageUrl(this.link)
    img.alt = this.alt
    img.loading = 'lazy'
    fig.appendChild(img)
    fig.addEventListener('mousedown', (e) => e.preventDefault())
    fig.addEventListener('click', () => zoomImage(this.link))
    return fig
  }
  ignoreEvent() {
    return false
  }
}

class CodeHeaderWidget extends WidgetType {
  constructor(readonly lang: string, readonly code: string) {
    super()
  }
  eq(other: CodeHeaderWidget) {
    return other.lang === this.lang && other.code === this.code
  }
  toDOM() {
    const head = document.createElement('span')
    head.className = 'cm-md-codeblock-head'
    head.dataset.code = this.code
    const lang = document.createElement('span')
    lang.className = 'cm-md-codeblock-lang'
    lang.textContent = this.lang || 'text'
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'cm-md-codeblock-copy'
    btn.textContent = i18n.global.t('copy')
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      navigator.clipboard.writeText(this.code)
      btn.textContent = '✓'
      setTimeout(() => {
        btn.textContent = i18n.global.t('copy')
      }, 1200)
    })
    head.append(lang, btn)
    return head
  }
  ignoreEvent() {
    return false
  }
}

class FenceEndWidget extends WidgetType {
  toDOM() {
    return document.createElement('span')
  }
  eq() {
    return true
  }
  ignoreEvent() {
    return true
  }
}

class HRWidget extends WidgetType {
  constructor(readonly pos: number, readonly cmView: EditorView) {
    super()
  }
  eq(other: HRWidget) {
    return other.pos === this.pos
  }
  toDOM() {
    const hr = document.createElement('span')
    hr.className = 'cm-md-hr'
    hr.addEventListener('mousedown', (e) => {
      e.preventDefault()
      this.cmView.dispatch({ selection: { anchor: this.pos } })
      this.cmView.focus()
    })
    return hr
  }
  ignoreEvent() {
    return false
  }
}

class TableWidget extends WidgetType {
  constructor(readonly table: GfmTable, readonly pos: number, readonly cmView: EditorView) {
    super()
  }
  eq(other: TableWidget) {
    return JSON.stringify(other.table) === JSON.stringify(this.table)
  }
  toDOM() {
    const wrap = document.createElement('span')
    wrap.className = 'cm-md-table'
    const table = document.createElement('table')
    const alignOf = (i: number) => this.table.align[i]
    const thead = document.createElement('thead')
    const trh = document.createElement('tr')
    this.table.header.forEach((h, i) => {
      const th = document.createElement('th')
      th.textContent = h
      const al = alignOf(i)
      if (al !== 'none') th.style.textAlign = al
      trh.appendChild(th)
    })
    thead.appendChild(trh)
    const tbody = document.createElement('tbody')
    this.table.rows.forEach((row) => {
      const tr = document.createElement('tr')
      for (let i = 0; i < this.table.header.length; i++) {
        const td = document.createElement('td')
        td.textContent = row[i] ?? ''
        const al = alignOf(i)
        if (al !== 'none') td.style.textAlign = al
        tr.appendChild(td)
      }
      tbody.appendChild(tr)
    })
    table.append(thead, tbody)
    wrap.appendChild(table)
    wrap.addEventListener('mousedown', (e) => {
      e.preventDefault()
      this.cmView.dispatch({ selection: { anchor: this.pos } })
      this.cmView.focus()
    })
    return wrap
  }
  ignoreEvent() {
    return false
  }
}

class MathWidget extends WidgetType {
  constructor(readonly tex: string, readonly display: boolean, readonly pos: number, readonly cmView: EditorView) {
    super()
  }
  eq(other: MathWidget) {
    return other.tex === this.tex && other.display === this.display
  }
  toDOM() {
    const span = document.createElement('span')
    span.className = 'cm-md-math' + (this.display ? ' cm-md-math-display' : '')
    try {
      span.innerHTML = katex.renderToString(this.tex, { throwOnError: false, displayMode: this.display })
    } catch {
      span.textContent = this.tex
    }
    span.addEventListener('mousedown', (e) => {
      e.preventDefault()
      this.cmView.dispatch({ selection: { anchor: this.pos } })
      this.cmView.focus()
    })
    return span
  }
  ignoreEvent() {
    return false
  }
}

const selBarOpen = ref(false)
const selBarLeft = ref(0)
const selBarTop = ref(0)
const selBarStyle = computed(() => ({ left: `${selBarLeft.value}px`, top: `${selBarTop.value}px` }))

function syncSelBar(v: EditorView) {
  if (isMobileViewport() || !v.hasFocus || v.state.selection.main.empty) {
    selBarOpen.value = false
    return
  }
  const range = v.state.selection.main
  const a = v.coordsAtPos(Math.min(range.from, range.to))
  const b = v.coordsAtPos(Math.max(range.from, range.to))
  const rect = editorContainer.value?.getBoundingClientRect()
  if (!a || !b || !rect) {
    selBarOpen.value = false
    return
  }
  const left = (a.left + b.left) / 2 - rect.left
  selBarLeft.value = Math.min(Math.max(left - 130, 8), Math.max(rect.width - 268, 8))
  let y = Math.min(a.top, b.top) - rect.top - 42
  if (y < 4) y = Math.max(b.bottom - rect.top + 6, 4)
  selBarTop.value = y
  selBarOpen.value = true
}

function onContextMenu(e: MouseEvent) {
  const target = e.target as HTMLElement
  const t = (key: string) => i18n.global.t(key)
  const items: MenuItem[] = []
  const imgEl = target.closest('.cm-md-img') as HTMLElement | null
  if (imgEl?.dataset.link) {
    items.push({ label: t('open_image'), onClick: () => zoomImage(imgEl.dataset.link!) })
    items.push({ label: t('copy_image_link'), onClick: () => navigator.clipboard.writeText(imgEl.dataset.link!) })
  }
  const headEl = target.closest('.cm-md-codeblock-head') as HTMLElement | null
  let codeEl = headEl
  if (!codeEl) {
    const lineEl = target.closest('.cm-line') as HTMLElement | null
    if (lineEl?.classList.contains('cm-md-codeblock')) {
      let prev = lineEl.previousElementSibling as HTMLElement | null
      while (prev && !prev.classList.contains('cm-md-codeblock-head-line')) {
        prev = prev.previousElementSibling as HTMLElement | null
      }
      codeEl = (prev?.querySelector('.cm-md-codeblock-head') as HTMLElement | null) ?? null
    }
  }
  if (codeEl?.dataset.code != null) {
    items.push({ label: t('copy_code'), onClick: () => navigator.clipboard.writeText(codeEl!.dataset.code!) })
  }
  const sel = view.value?.state.selection.main
  if (sel && !sel.empty) {
    if (items.length) items[0].divided = true
    items.push({ label: t('md_bold'), onClick: () => runCmd(toggleWrap, '**') })
    items.push({ label: t('md_italic'), onClick: () => runCmd(toggleWrap, '*') })
    items.push({ label: t('md_strike'), onClick: () => runCmd(toggleWrap, '~~') })
    items.push({ label: t('md_inline_code'), onClick: () => runCmd(toggleWrap, '`') })
    items.push({ label: t('md_link'), onClick: () => runCmd(toggleLink) })
  }
  if (!items.length) return
  e.preventDefault()
  contextmenu({ x: e.clientX, y: e.clientY, items })
}

const baseTheme = EditorView.theme({
  '&': { height: '100%', fontSize: '16px' },
  '.cm-scroller': {
    overflow: 'auto',
    lineHeight: '1.75',
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
  },
  '.cm-content': {
    maxWidth: '820px',
    margin: '0 auto',
    padding: '16px 40px 64px',
    caretColor: 'var(--md-sys-color-primary)',
  },
  '.cm-placeholder': { color: 'var(--md-sys-color-on-surface-variant)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-md-codeblock': {
    fontFamily: "'SF Mono', 'Fira Code', 'Fira Mono', Menlo, Consolas, monospace",
    fontSize: '13.5px',
    lineHeight: '1.6',
    backgroundColor: 'var(--md-sys-color-surface-container)',
  },
  '.cm-md-codeblock-last': { paddingBottom: '12px', borderRadius: '0 0 10px 10px' },
  '.cm-md-h1-line': { paddingTop: '18px', paddingBottom: '4px' },
  '.cm-md-h2-line': { paddingTop: '16px', paddingBottom: '4px' },
  '.cm-md-h3-line': { paddingTop: '12px', paddingBottom: '2px' },
  '.cm-md-h4-line': { paddingTop: '10px', paddingBottom: '2px' },
  '.cm-md-h5-line': { paddingTop: '10px', paddingBottom: '2px' },
  '.cm-md-h6-line': { paddingTop: '10px', paddingBottom: '2px' },
})

const lightTheme = EditorView.theme({
  '.cm-selectionBackground': { backgroundColor: 'rgba(63, 81, 181, 0.18) !important' },
})

const darkThemeOverride = EditorView.theme({
  '.cm-selectionBackground': { backgroundColor: 'rgba(190, 194, 255, 0.28) !important' },
})

function isCursorInside(view: EditorView, from: number, to: number): boolean {
  return view.state.selection.ranges.some((r) => r.from <= to && r.to >= from)
}

function buildLiveDecorations(v: EditorView): DecorationSet {
  const ranges: Range<Decoration>[] = []
  const hidden: Array<{ from: number; to: number }> = []
  const doc = v.state.doc
  const codeRanges: Array<{ from: number; to: number }> = []

  const addReplace = (from: number, to: number, widget?: WidgetType) => {
    if (to <= from) return
    if (hidden.some((h) => from < h.to && h.from < to)) return
    hidden.push({ from, to })
    ranges.push(Decoration.replace(widget ? { widget } : {}).range(from, to))
  }
  const addMark = (from: number, to: number, cls: string) => {
    if (to <= from) return
    ranges.push(Decoration.mark({ class: cls }).range(from, to))
  }
  const addLine = (from: number, cls: string) => {
    ranges.push(Decoration.line({ class: cls }).range(from))
  }
  const overlapsCode = (from: number, to: number) =>
    codeRanges.some((c) => from < c.to && c.from < to)

  const markNames = new Set(['EmphasisMark', 'CodeMark', 'StrikethroughMark'])

  const handleInline = (node: SyntaxNodeRef, cls: string) => {
    const active = isCursorInside(v, node.from, node.to)
    addMark(node.from, node.to, cls)
    const marks: Array<{ from: number; to: number }> = []
    for (let child = node.node.firstChild; child; child = child.nextSibling) {
      if (markNames.has(child.name)) marks.push({ from: child.from, to: child.to })
    }
    if (marks.length === 0) return
    const first = marks[0]
    const last = marks[marks.length - 1]
    if (active) {
      addMark(first.from, first.to, 'cm-md-mark')
      if (last !== first) addMark(last.from, last.to, 'cm-md-mark')
    } else {
      addReplace(first.from, first.to)
      if (last !== first) addReplace(last.from, last.to)
    }
  }

  const handleHeading = (node: SyntaxNodeRef, level: number) => {
    const active = isCursorInside(v, node.from, node.to)
    addLine(node.from, `cm-md-hline cm-md-h${level}-line`)
    addMark(node.from, node.to, `cm-md-h${level}`)
    const mark = node.node.firstChild
    if (mark && mark.name === 'HeaderMark') {
      const end = doc.sliceString(mark.to, mark.to + 1) === ' ' ? mark.to + 1 : mark.to
      if (active) addMark(mark.from, end, 'cm-md-mark')
      else addReplace(mark.from, end)
    }
  }

  const handleFenced = (node: SyntaxNodeRef) => {
    codeRanges.push({ from: node.from, to: node.to })
    const firstLine = doc.lineAt(node.from)
    const lastLine = doc.lineAt(node.to)
    const openMatch = firstLine.text.match(/^\s*(`{3,}|~{3,})(.*)$/)
    const lang = (openMatch?.[2] ?? '').trim().split(/\s+/)[0]
    const closeIsFence = lastLine.number > firstLine.number && /^\s*(`{3,}|~{3,})\s*$/.test(lastLine.text)
    const codeEnd = closeIsFence ? Math.max(firstLine.to + 1, lastLine.from - 1) : node.to
    const code = doc.sliceString(Math.min(firstLine.to + 1, codeEnd), codeEnd)
    ranges.push(Decoration.replace({ widget: new CodeHeaderWidget(lang, code) }).range(firstLine.from, firstLine.to))
    addLine(firstLine.from, 'cm-md-codeblock-head-line')
    const lastCodeNumber = closeIsFence ? lastLine.number - 1 : lastLine.number
    for (let n = firstLine.number + 1; n <= lastLine.number; n++) {
      if (closeIsFence && n === lastLine.number) continue
      const line = doc.line(n)
      addLine(line.from, n === lastCodeNumber ? 'cm-md-codeblock cm-md-codeblock-last' : 'cm-md-codeblock')
    }
    if (closeIsFence) {
      ranges.push(Decoration.replace({ widget: new FenceEndWidget() }).range(lastLine.from, lastLine.to))
      addLine(lastLine.from, 'cm-md-codeblock-end-line')
    }
  }

  const handleTask = (node: SyntaxNodeRef) => {
    let marker: SyntaxNodeRef | null = null
    for (let child = node.node.firstChild; child; child = child.nextSibling) {
      if (child.name === 'TaskMarker') {
        marker = child
        break
      }
    }
    if (!marker) return
    const checked = doc.sliceString(marker.from, marker.to) === '[x]'
    ranges.push(Decoration.replace({ widget: new CheckboxWidget(checked, marker.from, v) }).range(marker.from, marker.to))
    if (checked && node.to > marker.to) addMark(marker.to, node.to, 'cm-task-done')
  }

  const handleImage = (node: SyntaxNodeRef) => {
    if (isCursorInside(v, node.from, node.to)) return
    const m = doc.sliceString(node.from, node.to).match(/^!\[([^\]]*)\]\(([^)]+)\)$/)
    if (!m) return
    ranges.push(Decoration.replace({ widget: new ImageWidget(m[2], m[1]) }).range(node.from, node.to))
  }

  const handleTable = (node: SyntaxNodeRef) => {
    if (isCursorInside(v, node.from, node.to)) return
    const table = parseGfmTable(doc.sliceString(node.from, node.to))
    if (!table) return
    const firstLine = doc.lineAt(node.from)
    const lastLine = doc.lineAt(node.to)
    ranges.push(Decoration.replace({ widget: new TableWidget(table, node.from, v) }).range(firstLine.from, firstLine.to))
    addLine(firstLine.from, 'cm-md-table-line')
    for (let n = firstLine.number + 1; n <= lastLine.number; n++) {
      const line = doc.line(n)
      addReplace(line.from, line.to, new FenceEndWidget())
      addLine(line.from, 'cm-md-collapse-line')
    }
  }

  const handleHR = (node: SyntaxNodeRef) => {
    if (isCursorInside(v, node.from, node.to)) return
    const line = doc.lineAt(node.from)
    addReplace(line.from, line.to, new HRWidget(node.from, v))
    addLine(line.from, 'cm-md-hr-line')
  }

  const scanMath = () => {
    const consumed = new Set<number>()
    for (const { from, to } of v.visibleRanges) {
      const first = doc.lineAt(from).number
      const last = doc.lineAt(to).number
      for (let n = first; n <= last; n++) {
        if (consumed.has(n)) continue
        const line = doc.line(n)
        if (overlapsCode(line.from, line.to)) continue
        const trimmed = line.text.trim()
        const inlineSpans = findMathSpans(line.text, line.from)
        const sameLineDisplay = inlineSpans.some((s) => s.display)
        if (trimmed.startsWith('$$') && !sameLineDisplay) {
          let closeLine: typeof line | null = null
          for (let m = n + 1; m <= Math.min(n + 500, doc.lines); m++) {
            const candidate = doc.line(m)
            if (candidate.text.trim().endsWith('$$')) {
              closeLine = candidate
              break
            }
          }
          if (closeLine) {
            for (let m = n; m <= closeLine.number; m++) consumed.add(m)
            if (isCursorInside(v, line.from, closeLine.to)) continue
            const texParts = [line.text.trim().slice(2)]
            for (let m = n + 1; m < closeLine.number; m++) texParts.push(doc.line(m).text.trim())
            texParts.push(closeLine.text.trim().slice(0, -2))
            const tex = texParts.filter((p) => p.length > 0).join('\n')
            addReplace(line.from, line.to, new MathWidget(tex, true, line.from, v))
            addLine(line.from, 'cm-md-math-block-line')
            for (let m = n + 1; m <= closeLine.number; m++) {
              const mid = doc.line(m)
              addReplace(mid.from, mid.to, new FenceEndWidget())
              addLine(mid.from, 'cm-md-collapse-line')
            }
            continue
          }
        }
        for (const span of inlineSpans) {
          if (consumed.has(n)) break
          if (codeRanges.some((c) => span.from < c.to && c.from < span.to)) continue
          addReplace(span.from, span.to, new MathWidget(span.tex, span.display, span.from, v))
        }
      }
    }
  }

  for (const { from, to } of v.visibleRanges) {
    syntaxTree(v.state).iterate({
      from, to,
      enter(node) {
        switch (node.name) {
          case 'ATXHeading1': handleHeading(node, 1); break
          case 'ATXHeading2': handleHeading(node, 2); break
          case 'ATXHeading3': handleHeading(node, 3); break
          case 'ATXHeading4': handleHeading(node, 4); break
          case 'ATXHeading5': handleHeading(node, 5); break
          case 'ATXHeading6': handleHeading(node, 6); break
          case 'StrongEmphasis': handleInline(node, 'cm-md-strong'); break
          case 'Emphasis': handleInline(node, 'cm-md-em'); break
          case 'Strikethrough': handleInline(node, 'cm-md-strike'); break
          case 'InlineCode':
            codeRanges.push({ from: node.from, to: node.to })
            handleInline(node, 'cm-md-code-inline')
            break
          case 'FencedCode': handleFenced(node); break
          case 'Task': handleTask(node); break
          case 'Image': handleImage(node); break
          case 'Table': handleTable(node); break
          case 'HorizontalRule': handleHR(node); break
        }
      },
    })
  }
  scanMath()
  return RangeSet.of(ranges, true)
}

const livePreviewPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(v: EditorView) {
      this.decorations = buildLiveDecorations(v)
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged || update.selectionSet) {
        this.decorations = buildLiveDecorations(update.view)
      }
    }
  },
  { decorations: (v) => v.decorations },
)

const slashOpen = ref(false)
const slashQuery = ref('')
const slashFrom = ref(0)
const slashActive = ref(0)
const slashLeft = ref(0)
const slashTop = ref(0)

const slashFiltered = computed<SlashTemplate[]>(() => {
  const q = slashQuery.value.toLowerCase()
  if (!q) return SLASH_TEMPLATES
  const merged: SlashTemplate[] = []
  const push = (t: SlashTemplate) => {
    if (!merged.includes(t)) merged.push(t)
  }
  for (const t of filterSlashTemplates(q)) push(t)
  for (const t of SLASH_TEMPLATES) {
    if (i18n.global.t(`md_${t.id}`).toLowerCase().includes(q)) push(t)
  }
  return merged
})

watch(slashFiltered, (items) => {
  if (slashActive.value >= items.length) slashActive.value = 0
})

const slashStyle = computed(() => ({ left: `${slashLeft.value}px`, top: `${slashTop.value}px` }))

function closeSlash() {
  slashOpen.value = false
}

function syncSlash(v: EditorView) {
  if (!v.hasFocus) {
    closeSlash()
    return
  }
  const head = v.state.selection.main.head
  const line = v.state.doc.lineAt(head)
  const before = v.state.doc.sliceString(line.from, head)
  const query = matchSlashQuery(before)
  if (query === null) {
    closeSlash()
    return
  }
  slashQuery.value = query
  slashFrom.value = head - 1 - query.length
  if (slashFiltered.value.length === 0) {
    closeSlash()
    return
  }
  const rect = editorContainer.value?.getBoundingClientRect()
  const c = v.coordsAtPos(head)
  if (!rect || !c) {
    closeSlash()
    return
  }
  slashLeft.value = Math.min(Math.max(c.left - rect.left, 8), Math.max(rect.width - 280, 8))
  const menuH = Math.min(slashFiltered.value.length, 9) * 34 + 12
  let y = c.bottom - rect.top + 6
  if (y + menuH > rect.height) y = Math.max(c.top - rect.top - menuH - 6, 4)
  slashTop.value = y
  slashOpen.value = true
}

function applySlash(index: number) {
  const v = view.value
  const item = slashFiltered.value[index]
  if (!v || !item) return
  const to = v.state.selection.main.head
  const from = slashFrom.value
  v.dispatch({
    changes: { from, to, insert: item.text },
    selection: item.select
      ? { anchor: from + item.select[0], head: from + item.select[1] }
      : { anchor: from + item.cursor },
  })
  v.focus()
  closeSlash()
}

const slashKeys = [
  {
    key: 'ArrowDown',
    run: () => {
      if (!slashOpen.value) return false
      slashActive.value = (slashActive.value + 1) % slashFiltered.value.length
      return true
    },
  },
  {
    key: 'ArrowUp',
    run: () => {
      if (!slashOpen.value) return false
      const n = slashFiltered.value.length
      slashActive.value = (slashActive.value - 1 + n) % n
      return true
    },
  },
  {
    key: 'Enter',
    run: () => {
      if (!slashOpen.value) return false
      applySlash(slashActive.value)
      return true
    },
  },
  {
    key: 'Escape',
    run: () => {
      if (!slashOpen.value) return false
      closeSlash()
      return true
    },
  },
]

let isDark = document.documentElement.classList.contains('dark')

const mdHighlightStyle = HighlightStyle.define([
  { tag: highlightTags.heading, color: 'var(--md-sys-color-on-surface)', textDecoration: 'none', fontWeight: '600' },
  { tag: highlightTags.link, color: 'var(--md-sys-color-primary)', textDecoration: 'underline' },
])

function getExtensions(): Extension[] {
  const exts: Extension[] = [
    history(),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    highlightSelectionMatches(),
    markdown({ base: markdownLanguage, codeLanguages: languages }),
    livePreviewPlugin,
    syntaxHighlighting(mdHighlightStyle),
    syntaxHighlighting(defaultHighlightStyle),
    keymap.of([
      ...slashKeys,
      // macOS muscle memory: many users press Ctrl+Z/Ctrl+Y alongside Cmd
      { mac: 'Ctrl-z', run: undo },
      { mac: 'Ctrl-Shift-z', run: redo },
      { mac: 'Ctrl-y', run: redo },
      ...defaultKeymap,
      ...historyKeymap,
      ...closeBracketsKeymap,
      ...searchKeymap,
      indentWithTab,
    ]),
    EditorView.lineWrapping,
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        emit('update:modelValue', update.state.doc.toString())
      }
      if (update.docChanged || update.selectionSet || update.focusChanged) {
        syncSlash(update.view)
        syncSelBar(update.view)
      }
    }),
  ]
  if (props.placeholder) exts.push(cmPlaceholder(props.placeholder))
  exts.push(baseTheme, isDark ? oneDark : lightTheme, isDark ? darkThemeOverride : lightTheme)
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
  closeSlash()
  v.destroy()
  view.value = new EditorView({
    state: EditorState.create({ doc, extensions: getExtensions() }),
    parent: editorContainer.value!,
  })
}

function colorModeChangedHandler() {
  isDark = document.documentElement.classList.contains('dark')
  replaceTheme()
}

function onScroll() {
  selBarOpen.value = false
  if (slashOpen.value && view.value) syncSlash(view.value)
}

onMounted(() => {
  createEditor()
  editorContainer.value?.addEventListener('scroll', onScroll, true)
  emitter.on('color_mode_changed', colorModeChangedHandler)
})

onUnmounted(() => {
  editorContainer.value?.removeEventListener('scroll', onScroll, true)
  view.value?.destroy()
  emitter.off('color_mode_changed', colorModeChangedHandler)
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
  position: relative;
}
.markdown-editor :deep(.cm-editor) {
  height: 100%;
}
.markdown-editor :deep(.cm-md-h1) {
  font-size: 1.75em;
  font-weight: 700;
  line-height: 1.3;
  letter-spacing: -0.2px;
  text-decoration: none;
}
.markdown-editor :deep(.cm-md-h2) {
  font-size: 1.45em;
  font-weight: 650;
  text-decoration: none;
}
.markdown-editor :deep(.cm-md-h3) {
  font-size: 1.22em;
  font-weight: 600;
  text-decoration: none;
}
.markdown-editor :deep(.cm-md-h4) {
  font-size: 1.1em;
  font-weight: 600;
  text-decoration: none;
}
.markdown-editor :deep(.cm-md-h5),
.markdown-editor :deep(.cm-md-h6) {
  font-size: 1em;
  font-weight: 600;
  text-decoration: none;
}
.markdown-editor :deep(.cm-md-strong) {
  font-weight: 650;
}
.markdown-editor :deep(.cm-md-em) {
  font-style: italic;
}
.markdown-editor :deep(.cm-md-strike) {
  text-decoration: line-through;
}
.markdown-editor :deep(.cm-md-code-inline) {
  font-family: 'SF Mono', 'Fira Code', 'Fira Mono', Menlo, Consolas, monospace;
  font-size: 0.85em;
  background: var(--md-sys-color-surface-variant);
  border-radius: 5px;
  padding: 2px 5px;
}
.markdown-editor :deep(.cm-md-mark) {
  color: var(--md-sys-color-on-surface-variant);
  font-family: 'SF Mono', 'Fira Code', 'Fira Mono', Menlo, Consolas, monospace;
  font-size: 0.85em;
}

.slash-menu {
  position: absolute;
  z-index: 20;
  width: 264px;
  max-height: 320px;
  overflow-y: auto;
  border-radius: 12px;
  border: 1px solid var(--md-sys-color-outline-variant);
  background: var(--md-sys-color-surface-container-lowest);
  box-shadow: 0 8px 24px rgba(26, 27, 38, 0.16);
  padding: 6px;
  font-size: 13.5px;
}
.slash-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
  border-radius: 8px;
  color: var(--md-sys-color-on-surface);
  cursor: pointer;
}
.slash-item.hot {
  background: var(--md-sys-color-surface-container);
}
.slash-ic {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--md-sys-color-surface-container);
  color: var(--md-sys-color-on-surface-variant);
  font-size: 12px;
  font-weight: 600;
  font-family: 'SF Mono', 'Fira Code', Menlo, Consolas, monospace;
}
.slash-item.hot .slash-ic {
  background: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
}
.slash-label {
  flex: 1;
}
.slash-kbd {
  font-family: 'SF Mono', 'Fira Code', Menlo, Consolas, monospace;
  font-size: 10.5px;
  color: var(--md-sys-color-on-surface-variant);
}

.sel-toolbar {
  position: absolute;
  z-index: 25;
  display: inline-flex;
  align-items: center;
  gap: 1px;
  background: var(--md-sys-color-surface-container-high);
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: 10px;
  padding: 4px;
  box-shadow: 0 6px 20px rgba(26, 27, 38, 0.2);
}
.st-btn {
  min-width: 28px;
  height: 28px;
  border-radius: 7px;
  border: none;
  cursor: pointer;
  background: transparent;
  color: var(--md-sys-color-on-surface-variant);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: ui-monospace, Menlo, Consolas, monospace;
  font-size: 13px;
  padding: 0 5px;
}
.st-btn:hover {
  background: var(--md-sys-color-surface-container);
  color: var(--md-sys-color-on-surface);
}
.st-div {
  width: 1px;
  height: 16px;
  background: var(--md-sys-color-outline-variant);
  margin: 0 3px;
}

.markdown-editor :deep(.cm-md-task-box) {
  display: inline-flex;
  width: 17px;
  height: 17px;
  border-radius: 4.5px;
  border: 1.5px solid var(--md-sys-color-outline);
  margin-right: 6px;
  vertical-align: -3px;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: transparent;
  cursor: pointer;
  user-select: none;
}
.markdown-editor :deep(.cm-md-task-box.checked) {
  background: var(--md-sys-color-primary);
  border-color: var(--md-sys-color-primary);
  color: #fff;
}
.markdown-editor :deep(.cm-task-done) {
  text-decoration: line-through;
  color: var(--md-sys-color-on-surface-variant);
}

.markdown-editor :deep(.cm-md-img) {
  display: inline-block;
  cursor: zoom-in;
  line-height: 0;
}
.markdown-editor :deep(.cm-md-img img) {
  display: block;
  max-height: 320px;
  max-width: 100%;
  border-radius: 8px;
  border: 1px solid var(--md-sys-color-outline-variant);
}

.markdown-editor :deep(.cm-md-codeblock-head-line) {
  display: flex;
  align-items: center;
  padding: 0 0 2px;
}
.markdown-editor :deep(.cm-md-codeblock-head-line .cm-md-codeblock-head) {
  flex: 1;
}
.markdown-editor :deep(.cm-md-codeblock-head) {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  background: var(--md-sys-color-surface-container);
  border: 1px solid var(--md-sys-color-outline-variant);
  border-bottom: none;
  border-radius: 10px 10px 0 0;
  padding: 5px 6px 5px 14px;
  user-select: none;
}
.markdown-editor :deep(.cm-md-codeblock-lang) {
  font-family: 'SF Mono', 'Fira Code', Menlo, Consolas, monospace;
  font-size: 11px;
  letter-spacing: 0.4px;
  color: var(--md-sys-color-on-surface-variant);
}
.markdown-editor :deep(.cm-md-codeblock-copy) {
  border: none;
  cursor: pointer;
  border-radius: 6px;
  padding: 3px 8px;
  font-size: 12px;
  background: transparent;
  color: var(--md-sys-color-on-surface-variant);
}
.markdown-editor :deep(.cm-md-codeblock-copy:hover) {
  background: var(--md-sys-color-surface-high);
  color: var(--md-sys-color-on-surface);
}
.markdown-editor :deep(.cm-md-codeblock-end-line) {
  line-height: 0;
  font-size: 0;
  padding: 0;
}

.markdown-editor :deep(.cm-md-collapse-line) {
  line-height: 1px;
  font-size: 1px;
  padding: 0;
}
.markdown-editor :deep(.cm-md-table-line) {
  display: flex;
  padding: 6px 0;
}
.markdown-editor :deep(.cm-md-table-line .cm-md-table) {
  flex: 1;
}
.markdown-editor :deep(.cm-md-table) {
  display: block;
  overflow-x: auto;
}
.markdown-editor :deep(.cm-md-table table) {
  border-collapse: collapse;
  font-size: 0.92em;
}
.markdown-editor :deep(.cm-md-table th),
.markdown-editor :deep(.cm-md-table td) {
  border: 1px solid var(--md-sys-color-outline-variant);
  padding: 6px 12px;
}
.markdown-editor :deep(.cm-md-table th) {
  background: var(--md-sys-color-surface-container-low);
  font-weight: 650;
}
.markdown-editor :deep(.cm-md-table tr:hover td) {
  background: var(--md-sys-color-surface-container);
}
.markdown-editor :deep(.cm-md-hr-line) {
  display: flex;
  padding: 10px 0;
}
.markdown-editor :deep(.cm-md-hr) {
  flex: 1;
  border-top: 1px solid var(--md-sys-color-outline-variant);
  cursor: pointer;
}

.markdown-editor :deep(.cm-md-math) {
  white-space: normal;
}
.markdown-editor :deep(.cm-md-math-display) {
  display: block;
  overflow-x: auto;
  padding: 6px 0;
}
.markdown-editor :deep(.cm-md-math-display .katex-display) {
  margin: 0;
}
.markdown-editor :deep(.cm-md-math-block-line) {
  display: flex;
  padding: 2px 0;
}
.markdown-editor :deep(.cm-md-math-block-line .cm-md-math) {
  flex: 1;
}

.fmt-bar {
  display: none;
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 15;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px calc(6px + env(safe-area-inset-bottom));
  background: var(--md-sys-color-surface-container-low);
  border-top: 1px solid var(--md-sys-color-outline-variant);
}
.fb {
  width: 33px;
  height: 33px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--md-sys-color-on-surface-variant);
  font-size: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: ui-monospace, Menlo, Consolas, monospace;
  cursor: pointer;
}
.fb:active {
  background: var(--md-sys-color-surface-container-high);
  color: var(--md-sys-color-on-surface);
}

@media (max-width: 768px) {
  .fmt-bar {
    display: flex;
  }
  .sel-toolbar {
    display: none;
  }
  .markdown-editor :deep(.cm-content) {
    padding-bottom: 96px;
  }
}
</style>
