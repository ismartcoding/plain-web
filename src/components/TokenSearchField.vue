<template>
  <div ref="rootRef" class="token-field" :class="{ focused: isFocused }" @mousedown="onMouseDownRoot">
    <div
      ref="editableRef"
      class="editable"
      role="textbox"
      contenteditable="true"
      spellcheck="false"
      :data-placeholder="placeholder"
      @focus="onFocus"
      @blur="onBlur"
      @keydown="onKeydown"
      @input="onInput"
    ></div>

    <button v-tooltip="$t('search')" class="btn-icon trailing" @click.prevent.stop="emitEnter">
      <i-material-symbols:search-rounded />
    </button>

    <div v-if="menuLevel !== 'none'" class="dropdown" @mousedown.prevent>
      <template v-if="menuLevel === 'key'">
        <button
          v-for="(it, idx) in keyItems"
          :key="it.key"
          class="dd-item"
          :class="{ active: idx === activeIndex }"
          @mouseenter="activeIndex = idx"
          @click="selectKey(it.key)"
        >
          <div class="dd-main">{{ it.label }}</div>
          <div class="dd-sub">{{ it.description }}</div>
        </button>
      </template>

      <template v-else>
        <div class="dd-header">
          <button class="dd-back" type="button" aria-label="Back" @click.stop="openKeyMenu">
            <i-material-symbols:arrow-back-rounded />
          </button>
          <div class="dd-title">
            <span class="dd-title-key">{{ selectedKeyLabel }}</span>
          </div>

          <button
            v-if="selectedKey === 'history' && valueItems.length > 0"
            class="dd-clear"
            type="button"
            @click.stop="emitHistoryClear"
          >
            {{ t('clear_list') }}
          </button>
        </div>

        <div class="dd-values">
          <div v-if="selectedKey === 'start_time'" class="dd-custom">
            <div class="dd-custom-row">
              <label class="dd-custom-label">{{ t('start_time') }}</label>
              <select v-model="customStartTimeOp" class="dd-custom-op" aria-label="Operator">
                <option value=">=">&gt;=</option>
                <option value="=">=</option>
                <option value="<=">&lt;=</option>
              </select>
              <input v-model="customStartDate" class="dd-custom-date" type="date" :aria-label="t('start_time')" />
              <button class="dd-custom-apply" type="button" :disabled="!customStartDate" @click="applyCustomStartTime">
                {{ t('apply') }}
              </button>
            </div>
            <div class="dd-custom-hint">{{ t('search_calendar_select_date') }}</div>
          </div>

          <div
            v-for="(it, idx) in valueItems"
            :key="it.key + ':' + it.value"
            class="dd-item-row"
            :class="{ active: idx === activeIndex }"
            @mouseenter="activeIndex = idx"
          >
            <button class="dd-item dd-item-main" type="button" @click="selectValue(it)">
              <div class="dd-main">{{ it.label }}</div>
              <div v-if="it.description" class="dd-sub">{{ it.description }}</div>
            </button>

            <button
              v-if="selectedKey === 'history'"
              class="dd-item-delete"
              type="button"
              :aria-label="t('delete')"
              @click.stop="emitHistoryDelete(it.value)"
            >
              ×
            </button>
          </div>
          <div v-if="valueItems.length === 0 && selectedKey !== 'start_time'" class="dd-empty">{{ t('search_no_results') }}</div>
        </div>
      </template>
    </div>

    <div class="outline"></div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

export type TokenKey = string

export interface Token {
  key: TokenKey
  value: string
}

type MenuLevel = 'none' | 'key' | 'value'

interface KeyItem {
  key: TokenKey
  label: string
  description: string
}

interface ValueItem {
  key: TokenKey
  value: string
  label: string
  description?: string
}

type ValueOption =
  | string
  | {
      value: string
      label: string
      description?: string
    }

const props = withDefaults(
  defineProps<{
    text: string
    tokens: Token[]
    placeholder?: string
    // When true, Enter triggers submit even if dropdown is open.
    // This matches the common "press Enter to search" expectation.
    enterSubmits?: boolean
    keyOptions: TokenKey[]
    valueOptions?: Record<string, ValueOption[]>
  }>(),
  {
    placeholder: '',
    enterSubmits: false,
    valueOptions: () => ({}),
  }
)

const emit = defineEmits<{
  'update:text': [value: string]
  'update:tokens': [value: Token[]]
  focus: []
  blur: []
  enter: []
  'history:select': [value: string]
  'history:delete': [value: string]
  'history:clear': []
}>()

const rootRef = ref<HTMLElement | null>(null)
const editableRef = ref<HTMLDivElement | null>(null)
const valueSearchRef = ref<HTMLInputElement | null>(null)
const isFocused = ref(false)
const menuLevel = ref<MenuLevel>('none')
const selectedKey = ref<TokenKey>('')
const valueSearch = ref('')
const activeIndex = ref(0)
const editingTokenEl = ref<HTMLElement | null>(null)

const customStartTimeOp = ref('>=')
const customStartDate = ref('')

const { t } = useI18n()

const placeholder = computed(() => props.placeholder ?? '')

function normalizeSpace(s: string) {
  return s.replace(/\s+/g, ' ').trim()
}

function keyLabel(key: string) {
  if (key === 'tag') return t('tag')
  if (key === 'bucket') return t('folder')
  if (key === 'type') return t('type')
  if (key === 'feed_id') return t('feed')
  if (key === 'duration') return t('duration')
  if (key === 'start_time') return t('start_time')
  if (key === 'history') return t('search_key_history')
  if (key === 'file_size') return t('file_size')
  return key
}

function keyDescription(key: string) {
  if (key === 'tag') return t('search_filter_by_tag')
  if (key === 'bucket') return t('search_filter_by_folder')
  if (key === 'type') return ''
  if (key === 'history') return ''
  if (key === 'file_size') return t('search_filter_by_file_size')
  if (key === 'duration') return t('search_filter_by_duration')
  if (key === 'start_time') return t('search_filter_by_start_time')
  return ''
}

function displayValue(key: string, raw: string) {
  const s = String(raw ?? '').trim()

  // Always format comparison-style values first (even if valueOptions has a label),
  // because the raw value may be numeric/epoch and should be human-friendly.
  if (key === 'duration') {
    return withOp(s, (v) => humanizeSeconds(v))
  }

  if (key === 'start_time') {
    return withOp(s, (v) => humanizeDateOrEpoch(v))
  }

  if (key === 'file_size') {
    const optionLabel = resolveOptionLabel(key, s)
    if (optionLabel) return optionLabel
    return withOp(s, (v) => v)
  }

  if (key === 'trash') {
    const v = s.toLowerCase()
    if (v === 'true') return t('in_trash')
    if (v === 'false') return t('not_in_trash')
    return s
  }

  const optionLabel = resolveOptionLabel(key, s)
  if (optionLabel) return optionLabel

  return s
}

function resolveOptionLabel(key: string, raw: string): string {
  const options = (props.valueOptions ?? {})[key] ?? []
  for (const opt of options) {
    if (typeof opt === 'string') {
      if (opt === raw) return opt
      continue
    }
    if (opt.value === raw) return opt.label
  }
  return ''
}

function splitLeadingOp(raw: string) {
  const match = raw.match(/^([><=!]+)?\s*(.+)$/)
  if (!match) return { op: '', value: '' }
  return { op: match[1] || '', value: (match[2] || '').trim() }
}

function withOp(raw: string, format: (value: string) => string) {
  const { op, value } = splitLeadingOp(raw)
  if (!value) return raw
  const formatted = format(value)
  if (!op) return formatted
  return `${op} ${formatted}`
}

function humanizeSeconds(raw: string) {
  const n = raw.trim().match(/^\d+$/) ? Number(raw.trim()) : NaN
  if (!Number.isFinite(n) || n < 0) return raw
  const total = Math.floor(n)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return s === 0 ? `${h}h ${m}m` : `${h}h ${m}m ${s}s`
  if (m > 0) return s === 0 ? `${m}m` : `${m}m ${s}s`
  return `${s}s`
}

function humanizeDateOrEpoch(raw: string) {
  const v = raw.trim()
  if (!v) return ''

  // YYYY-MM-DD (from the date picker)
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v

  // Epoch seconds/millis
  if (/^\d+$/.test(v)) {
    const asNum = Number(v)
    if (!Number.isFinite(asNum)) return v
    const ms = v.length <= 10 ? asNum * 1000 : asNum
    const d = new Date(ms)
    if (Number.isNaN(d.getTime())) return v
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }

  return v
}

function applyCustomStartTime() {
  const d = String(customStartDate.value ?? '').trim()
  if (!d) return
  const value = `${customStartTimeOp.value}${d}`
  selectValue({ key: 'start_time', value, label: value })
}

function isTokenEl(node: Node | null): node is HTMLElement {
  return !!node && node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).dataset?.kind === 'token'
}

function setCaretAfter(node: Node) {
  const sel = window.getSelection()
  if (!sel) return
  const range = document.createRange()
  range.setStartAfter(node)
  range.collapse(true)
  sel.removeAllRanges()
  sel.addRange(range)
}

function setCaretAtEnd() {
  const el = editableRef.value
  if (!el) return
  const sel = window.getSelection()
  if (!sel) return
  const range = document.createRange()
  range.selectNodeContents(el)
  range.collapse(false)
  sel.removeAllRanges()
  sel.addRange(range)
}

function extractTokensAndText() {
  const el = editableRef.value
  if (!el) return { tokens: [] as Token[], text: '' }

  const tokens: Token[] = []
  const textParts: string[] = []

  for (const node of Array.from(el.childNodes)) {
    if (isTokenEl(node)) {
      const k = node.dataset.key ?? ''
      const v = node.dataset.value ?? ''
      if (k && v) tokens.push({ key: k, value: v })
      continue
    }

    const t = (node.textContent ?? '').replace(/\u00A0/g, ' ')
    if (t) textParts.push(t)
  }

  return {
    tokens,
    text: normalizeSpace(textParts.join(' ')),
  }
}

function clearAndRender(tokens: Token[], text: string) {
  const el = editableRef.value
  if (!el) return

  el.innerHTML = ''

  for (const t of tokens) {
    el.appendChild(makeToken(t.key, t.value))
    el.appendChild(document.createTextNode(' '))
  }

  if (text) {
    el.appendChild(document.createTextNode(text))
  }
}

function makeToken(key: string, value: string) {
  const span = document.createElement('span')
  span.className = 'token'
  span.dataset.kind = 'token'
  span.dataset.key = key
  span.dataset.value = value
  span.contentEditable = 'false'

  const keySpan = document.createElement('span')
  keySpan.className = 'token-key'
  keySpan.textContent = keyLabel(key)

  const sep = document.createElement('span')
  sep.className = 'token-sep'
  sep.textContent = ':'

  const valSpan = document.createElement('span')
  valSpan.className = 'token-value'
  valSpan.textContent = displayValue(key, value)

  const close = document.createElement('button')
  close.className = 'token-remove'
  close.type = 'button'
  close.textContent = '×'
  close.setAttribute('aria-label', 'Remove')
  close.addEventListener('mousedown', (e) => {
    e.preventDefault()
    e.stopPropagation()
  })
  close.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    span.remove()
    syncOut()
    nextTick(() => setCaretAtEnd())
  })

  span.addEventListener('mousedown', (e) => {
    // Atomic token: can be deleted or re-selected, not edited as text.
    if ((e.target as HTMLElement | null)?.classList?.contains('token-remove')) return
    e.preventDefault()
    e.stopPropagation()
    editingTokenEl.value = span
    selectedKey.value = key
    menuLevel.value = 'value'
    valueSearch.value = ''
    activeIndex.value = 0
    nextTick(() => valueSearchRef.value?.focus())
  })

  span.appendChild(keySpan)
  span.appendChild(sep)
  span.appendChild(valSpan)
  span.appendChild(close)
  return span
}

const keyItems = computed<KeyItem[]>(() => {
  return (props.keyOptions ?? []).map((k) => ({
    key: k,
    label: keyLabel(k),
    description: keyDescription(k),
  }))
})

const selectedKeyLabel = computed(() => keyLabel(selectedKey.value))

const valueItems = computed<ValueItem[]>(() => {
  const k = selectedKey.value
  if (!k) return []

  const raw = (props.valueOptions ?? {})[k] ?? []
  const all = raw
    .map((v) => {
      if (typeof v === 'string') return { key: k, value: v, label: v } as ValueItem
      return { key: k, value: v.value, label: v.label, description: v.description } as ValueItem
    })
    .filter((it) => it.value)
  const q = valueSearch.value.trim().toLowerCase()
  if (!q) return all
  return all.filter((it) => it.label.toLowerCase().includes(q))
})

function emitHistoryDelete(value: string) {
  emit('history:delete', value)
}

function emitHistoryClear() {
  emit('history:clear')
  // Stay in control flow: go back to the key menu.
  nextTick(() => openKeyMenu())
}

function openKeyMenu() {
  menuLevel.value = 'key'
  selectedKey.value = ''
  valueSearch.value = ''
  activeIndex.value = 0
  editingTokenEl.value = null
  nextTick(() => editableRef.value?.focus())
}

function selectKey(key: TokenKey) {
  selectedKey.value = key
  menuLevel.value = 'value'
  valueSearch.value = ''
  activeIndex.value = 0

  if (key === 'start_time') {
    customStartTimeOp.value = '>='
    customStartDate.value = ''
  }

  nextTick(() => valueSearchRef.value?.focus())
}

function closeMenu() {
  menuLevel.value = 'none'
  selectedKey.value = ''
  valueSearch.value = ''
  activeIndex.value = 0
  editingTokenEl.value = null
}

function removeTokensByKey(key: string) {
  const el = editableRef.value
  if (!el) return
  for (const node of Array.from(el.childNodes)) {
    if (isTokenEl(node) && (node.dataset.key ?? '') === key) {
      node.remove()
    }
  }
}

function insertTokenAtCaret(tokenEl: HTMLElement) {
  const el = editableRef.value
  if (!el) return

  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) {
    el.appendChild(tokenEl)
    el.appendChild(document.createTextNode(' '))
    setCaretAfter(tokenEl)
    return
  }

  const range = sel.getRangeAt(0)
  if (!range.collapsed) {
    range.deleteContents()
  }

  // Ensure insertion happens inside our editable
  const containerNode = range.startContainer
  if (!el.contains(containerNode)) {
    el.appendChild(tokenEl)
    el.appendChild(document.createTextNode(' '))
    setCaretAfter(tokenEl)
    return
  }

  range.insertNode(tokenEl)
  const space = document.createTextNode(' ')
  tokenEl.after(space)
  nextTick(() => setCaretAfter(space))
}

function selectValue(it: ValueItem) {
  if (it.key === 'history') {
    closeMenu()
    // Let parent update tokens/text, and allow our watcher to render from props.
    // If we stay focused, we intentionally avoid re-rendering to keep caret stable.
    editableRef.value?.blur()
    nextTick(() => emit('history:select', it.value))
    return
  }

  // Unique keys behave like a single filter.
  const uniqueKeys = new Set(['bucket', 'trash', 'file_size', 'type', 'feed_id', 'duration', 'start_time'])
  if (uniqueKeys.has(it.key)) {
    removeTokensByKey(it.key)
  }

  if (editingTokenEl.value && (editingTokenEl.value.dataset.key ?? '') === it.key) {
    editingTokenEl.value.dataset.value = it.value
    const v = editingTokenEl.value.querySelector('.token-value') as HTMLElement | null
    if (v) v.textContent = displayValue(it.key, it.value)
  } else {
    insertTokenAtCaret(makeToken(it.key, it.value))
  }

  syncOut()
  editingTokenEl.value = null

  // Continuous add: keep the field active and reopen key menu.
  nextTick(() => {
    editableRef.value?.focus()
    openKeyMenu()
  })
}

function syncOut() {
  const res = extractTokensAndText()
  emit('update:tokens', res.tokens)
  emit('update:text', res.text)
}

function onInput() {
  syncOut()
}

function emitEnter() {
  closeMenu()
  emit('enter')
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault()
    openKeyMenu()
    return
  }

  if (e.key === ' ' && menuLevel.value === 'none') {
    // Space-after: open the filter key menu (doesn't block normal text entry).
    // We only trigger when caret is at the end to avoid interrupting mid-text typing.
    const sel = window.getSelection()
    const el = editableRef.value
    if (sel && el && sel.rangeCount > 0) {
      const r = sel.getRangeAt(0)
      if (r.collapsed && el.contains(r.startContainer)) {
        const atEnd = r.startContainer === el && r.startOffset === el.childNodes.length
        if (atEnd) {
          openKeyMenu()
        }
      }
    }
  }

  if (e.key === 'Escape') {
    if (menuLevel.value !== 'none') {
      e.preventDefault()
      closeMenu()
    }
    return
  }

  if (menuLevel.value !== 'none' && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
    e.preventDefault()
    const max = (menuLevel.value === 'key' ? keyItems.value.length : valueItems.value.length) - 1
    if (max < 0) return
    activeIndex.value = e.key === 'ArrowDown' ? Math.min(activeIndex.value + 1, max) : Math.max(activeIndex.value - 1, 0)
    return
  }

  if (menuLevel.value !== 'none' && (e.key === 'Enter' || e.key === 'Tab')) {
    e.preventDefault()

    // Optional behavior: pressing Enter submits instead of selecting from the dropdown.
    if (e.key === 'Enter' && props.enterSubmits) {
      emitEnter()
      return
    }

    if (menuLevel.value === 'key') {
      const it = keyItems.value[activeIndex.value]
      if (it) selectKey(it.key)
      return
    }
    const it = valueItems.value[activeIndex.value]
    if (it) selectValue(it)
    return
  }

  if (e.key === 'Enter') {
    e.preventDefault()
    emitEnter()
    return
  }

  if (e.key === 'Backspace') {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return
    const r = sel.getRangeAt(0)
    if (!r.collapsed) return

    // If caret is at the start of a text node and previous sibling is a token, remove it
    const node = r.startContainer
    if (node.nodeType === Node.TEXT_NODE && r.startOffset === 0) {
      const prev = (node as Text).previousSibling
      if (isTokenEl(prev)) {
        e.preventDefault()
        prev.remove()
        syncOut()
      }
    }
  }
}

function onFocus() {
  isFocused.value = true
  emit('focus')
  // HeaderSearch UX: clicking/focusing the field should immediately show the hint dropdown.
  // Only do this when there are available keys and the menu isn't already open.
  if (menuLevel.value === 'none' && keyItems.value.length > 0) {
    openKeyMenu()
  }
}

function onBlur() {
  isFocused.value = false
  emit('blur')
  nextTick(() => {
    syncOut()
  })
}

function onMouseDownRoot(e: MouseEvent) {
  // If the field is already focused and the menu was closed by Enter/search button,
  // a click won't re-trigger focus. Re-open the key menu on click.
  if (isFocused.value && menuLevel.value === 'none' && keyItems.value.length > 0) {
    const target = e.target as HTMLElement | null
    if (!target?.closest?.('button.trailing')) {
      openKeyMenu()
    }
  }

  // Clicking empty space in the field should focus and put caret at end
  const el = editableRef.value
  if (!el) return
  if (e.target === el) {
    nextTick(() => setCaretAtEnd())
  }
}

function renderFromProps() {
  clearAndRender(props.tokens, props.text)
}

watch(
  () => [props.tokens, props.text] as const,
  () => {
    if (isFocused.value) return
    nextTick(() => renderFromProps())
  },
  { deep: true }
)

onMounted(() => {
  renderFromProps()
  document.addEventListener('mousedown', onDocumentMouseDown, { capture: true })
})

onUnmounted(() => {
  document.removeEventListener('mousedown', onDocumentMouseDown, { capture: true } as any)
})

function onDocumentMouseDown(e: MouseEvent) {
  const root = rootRef.value
  if (!root) return
  if (!root.contains(e.target as Node)) {
    closeMenu()
  }
}

defineExpose({
  focus: () => {
    editableRef.value?.focus()
  },
})
</script>

<style scoped>
.dd-custom {
  padding: 10px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

.dd-custom-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dd-custom-label {
  font-size: 12px;
  opacity: 0.8;
  white-space: nowrap;
}

.dd-custom-op,
.dd-custom-date {
  height: 30px;
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 8px;
  padding: 0 8px;
  background: transparent;
}

.dd-custom-date {
  flex: 1;
}

.dd-custom-apply {
  height: 30px;
  padding: 0 10px;
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.15);
  background: transparent;
}

.dd-custom-apply:disabled {
  opacity: 0.5;
}

.dd-custom-hint {
  margin-top: 6px;
  font-size: 12px;
  opacity: 0.7;
}
</style>
