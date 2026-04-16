import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useTempStore } from '@/stores/temp'
import { storeToRefs } from 'pinia'
import { useMarkdown } from '@/hooks/markdown'
import { getApiBaseUrl } from '@/lib/api/api'
import { initMutation, runMutation, writeTextFileGQL } from '@/lib/api/mutation'
import { gqlFetch } from '@/lib/api/gql-client'
import { appGQL } from '@/lib/api/query'
import { tokenToKey } from '@/lib/api/file'
import { chachaDecrypt } from '@/lib/api/crypto'

export function useTextFile() {
  const { t } = useI18n()
  const route = useRoute()
  const router = useRouter()
  const tempStore = useTempStore()
  const { app, urlTokenKey } = storeToRefs(tempStore)

  const isLoggedIn = computed(() => !!localStorage.getItem('auth_token'))

  const loading = ref(true)
  const error = ref('')
  const content = ref('')
  const draft = ref('')
  const fileName = ref('')
  const fileSize = ref(0)
  const lastModified = ref('')
  const jsonData = ref<any>(null)
  const renderedMarkdown = ref('')
  const showRawText = ref(false)
  const textWrap = ref(true)
  const showSavedPulse = ref(false)
  let savedPulseTimer: number | null = null

  const { render } = useMarkdown(app, urlTokenKey)

  // Computed
  const isJsonFile = computed(() => fileName.value.toLowerCase().endsWith('.json'))
  const isMarkdownFile = computed(() => {
    const name = fileName.value.toLowerCase()
    return name.endsWith('.md') || name.endsWith('.markdown')
  })
  const canToggleView = computed(() => isJsonFile.value || isMarkdownFile.value)

  const extension = computed(() => {
    const name = (fileName.value || '').toLowerCase()
    const idx = name.lastIndexOf('.')
    return idx <= 0 ? '' : name.substring(idx + 1)
  })

  const LANG_MAP: Record<string, string> = {
    json: 'json', md: 'markdown', markdown: 'markdown',
    yaml: 'yaml', yml: 'yaml',
    js: 'javascript', mjs: 'javascript', cjs: 'javascript',
    ts: 'typescript', mts: 'typescript', cts: 'typescript',
    go: 'go', css: 'css', html: 'html', htm: 'html',
    sh: 'shell', bash: 'shell', toml: 'toml',
  }
  const language = computed(() => LANG_MAP[extension.value] || 'plaintext')

  const fileId = computed(() => String(route.query.id ?? '').trim())
  const decryptedPath = ref('')
  const isEditing = computed(() => route.name === 'text-edit')
  const dirty = computed(() => draft.value !== content.value)
  const displayTitle = computed(() => {
    const base = fileName.value || t('view')
    return isEditing.value && dirty.value ? `${base} *` : base
  })
  const statusText = computed(() => {
    if (!isEditing.value || loading.value || error.value) return ''
    if (saving.value) return t('saving')
    if (showSavedPulse.value) return t('saved')
    return ''
  })
  const canEdit = computed(() => isLoggedIn.value && !!decryptedPath.value)

  // Mutation
  const { mutate: writeTextFile, loading: saving, onDone: onWriteDone, onError: onWriteError } = initMutation({
    document: writeTextFileGQL,
  })

  // Helpers
  async function ensureUrlTokenKey() {
    if (urlTokenKey.value || !isLoggedIn.value) return
    try {
      const r = await gqlFetch(appGQL)
      const newToken = r?.data?.app?.urlToken
      if (newToken) {
        urlTokenKey.value = tokenToKey(newToken)
        tempStore.app = r?.data?.app
      }
    } catch { /* ignore */ }
  }

  function tryDecryptPathFromID(id: string) {
    try {
      if (!id || !urlTokenKey.value) return ''
      const bits = tokenToKey(id)
      const decrypted = chachaDecrypt(urlTokenKey.value, bits)
      if (decrypted.startsWith('{')) {
        try { return JSON.parse(decrypted).path || '' } catch { return '' }
      }
      return decrypted
    } catch { return '' }
  }

  const applyTextContent = async (textContent: string, resetViewMode: boolean) => {
    content.value = textContent
    draft.value = textContent
    jsonData.value = null
    renderedMarkdown.value = ''
    if (resetViewMode) showRawText.value = false

    if (isJsonFile.value) {
      try { jsonData.value = JSON.parse(textContent) } catch { error.value = t('invalid_json_format') }
    } else if (isMarkdownFile.value) {
      try { renderedMarkdown.value = await render(textContent) } catch { /* fallback to raw */ }
    }
  }

  const fetchTextContent = async () => {
    try {
      loading.value = true
      error.value = ''
      const id = route.query.id as string
      if (!id) { error.value = t('invalid_file_id'); return }

      const response = await fetch(`${getApiBaseUrl()}/fs?id=${encodeURIComponent(id)}`)
      if (!response.ok) {
        error.value = response.status === 404 ? t('file_not_found')
          : response.status === 403 ? t('access_denied')
          : t('failed_to_load_file')
        return
      }

      const cd = response.headers.get('content-disposition')
      if (cd) {
        const match = cd.match(/filename="?([^"]+)"?/)
        if (match) try { fileName.value = decodeURIComponent(match[1]).replace(/[/\\:*?"<>|]+/g, '_') } catch { /* ignore */ }
      }
      const cl = response.headers.get('content-length')
      if (cl) fileSize.value = parseInt(cl)
      const lm = response.headers.get('last-modified')
      if (lm) lastModified.value = lm

      await applyTextContent(await response.text(), true)
    } catch { error.value = t('network_error') } finally { loading.value = false }
  }

  const retry = () => fetchTextContent()
  const openEditor = () => { if (canEdit.value) router.push({ name: 'text-edit', query: { id: fileId.value } }) }
  const openViewer = () => { router.push({ name: 'text-file', query: { id: fileId.value } }) }
  const toggleViewMode = () => { showRawText.value = !showRawText.value }
  const toggleTextWrap = () => { textWrap.value = !textWrap.value }

  const downloadFile = () => {
    if (!content.value || !fileName.value) return
    const blob = new Blob([content.value], { type: 'text/plain;charset=utf-8' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName.value
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }

  async function save() {
    if (!canEdit.value || !isEditing.value || !decryptedPath.value || saving.value || !dirty.value) return
    const ok = await runMutation(writeTextFile, { path: decryptedPath.value, content: draft.value, overwrite: true })
    if (!ok) return
    await applyTextContent(draft.value, false)
    showSavedPulse.value = true
    if (savedPulseTimer) window.clearTimeout(savedPulseTimer)
    savedPulseTimer = window.setTimeout(() => { showSavedPulse.value = false; savedPulseTimer = null }, 1500)
  }

  function onKeyDown(e: KeyboardEvent) {
    if (!isEditing.value || !(e.ctrlKey || e.metaKey) || e.altKey) return
    if (e.key !== 's' && e.key !== 'S') return
    e.preventDefault(); e.stopPropagation(); save()
  }

  // Lifecycle
  watch(() => fileId.value, async (id) => {
    decryptedPath.value = ''
    if (!id) return
    await ensureUrlTokenKey()
    decryptedPath.value = tryDecryptPathFromID(id)
    fetchTextContent()
  }, { immediate: true })

  onMounted(() => { window.addEventListener('keydown', onKeyDown, { capture: true }) })
  onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKeyDown, { capture: true } as any)
    if (savedPulseTimer) window.clearTimeout(savedPulseTimer)
  })
  watch([fileName, dirty, isEditing], () => { document.title = displayTitle.value })

  return {
    loading, error, content, draft, fileName, fileSize, lastModified,
    jsonData, renderedMarkdown, showRawText, textWrap, saving,
    isJsonFile, isMarkdownFile, canToggleView, language,
    isEditing, dirty, displayTitle, statusText, canEdit, showSavedPulse,
    retry, openEditor, openViewer, toggleViewMode, toggleTextWrap,
    downloadFile, save, isLoggedIn,
  }
}
