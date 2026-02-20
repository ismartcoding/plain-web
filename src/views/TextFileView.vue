<!-- eslint-disable vue/no-v-html -->
<template>
  <div class="page">
    <header class="topbar">
      <div class="title-wrap">
        <div class="title">{{ displayTitle }}</div>
        <div class="meta">
          <span v-if="fileSize">{{ formatFileSize(fileSize) }}</span>
          <span v-if="lastModified" v-tooltip="formatDateTime(lastModified)">{{ formatTimeAgo(lastModified) }}</span>
        </div>
      </div>

      <div v-if="statusText" class="status" :class="{ saving: saving }">
        <v-circular-progress v-if="saving" indeterminate :size="16" :width="2" />
        <i-material-symbols:check-circle-rounded v-else class="status-icon" />
        <span class="status-text">{{ statusText }}</span>
      </div>

      <div class="actions">
        <v-outlined-button v-if="!isEditing" class="action-btn" @click="downloadFile">
          <i-lucide-download />
          {{ $t('download') }}
        </v-outlined-button>

        <template v-if="isEditing">
          <v-outlined-button class="action-btn" :loading="saving" :disabled="saving || !dirty" @click="save">
            {{ $t('save') }}
          </v-outlined-button>
          <v-outlined-button class="action-btn" @click="openViewer">
            {{ $t('view') }}
          </v-outlined-button>
        </template>
        <template v-else>
          <v-outlined-button v-if="canToggleView" class="action-btn" @click="toggleViewMode">
            <i-lucide-eye v-if="showRawText" />
            <i-lucide-code v-else />
            {{ showRawText ? $t('formatted_view') : $t('raw_text') }}
          </v-outlined-button>

          <v-outlined-button
            v-if="showRawText || (!isJsonFile && !isMarkdownFile)"
            class="action-btn"
            @click="toggleTextWrap"
          >
            <i-lucide-wrap-text />
            {{ textWrap ? $t('unwrap') : $t('wrap') }}
          </v-outlined-button>

          <v-outlined-button v-if="canEdit" class="action-btn" @click="openEditor">
            <i-lucide-pencil />
            {{ $t('edit') }}
          </v-outlined-button>
        </template>

        <header-actions :logged-in="isLoggedIn" />
      </div>
    </header>

    <main class="main">
      <section v-if="loading" class="state">
        <v-circular-progress indeterminate />
        <span class="state-text">{{ $t('loading') }}</span>
      </section>

      <section v-else-if="error" class="state error">
        <i-material-symbols:error-outline-rounded class="state-icon" />
        <span class="state-text">{{ error }}</span>
        <v-outlined-button @click="retry">{{ $t('retry') }}</v-outlined-button>
      </section>

      <section v-else-if="isEditing" class="editor">
        <MonacoEditor v-model="draft" :language="language" :options="editorOptions" height="100%" />
      </section>

      <section v-else class="viewer">
        <div class="viewer-card">
          <pre
            v-if="showRawText || (!isJsonFile && !isMarkdownFile)"
            class="view-raw text-view"
            :class="{ 'text-wrap': textWrap }"
          >{{ content }}</pre>
          <json-viewer v-else-if="isJsonFile" :value="jsonData" :expand-depth="2" />
          <div v-else-if="isMarkdownFile" class="md-container" v-html="renderedMarkdown"></div>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { getApiBaseUrl } from '@/lib/api/api'
import { formatDateTime, formatFileSize, formatTimeAgo } from '@/lib/format'
import { useMarkdown } from '@/hooks/markdown'
import { useTempStore } from '@/stores/temp'
import JsonViewer from '@/components/jsonviewer/json-viewer.vue'
import MonacoEditor from '@/components/MonacoEditor.vue'
import { initMutation, runMutation, writeTextFileGQL } from '@/lib/api/mutation'
import apollo from '@/plugins/apollo'
import { appGQL } from '@/lib/api/query'
import { tokenToKey } from '@/lib/api/file'
import { chachaDecrypt } from '@/lib/api/crypto'
import * as sjcl from 'sjcl'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const tempStore = useTempStore()
const { app, urlTokenKey } = storeToRefs(tempStore)

const isLoggedIn = computed(() => !!localStorage.getItem('auth_token'))

// Reactive state
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

// Computed properties
const isJsonFile = computed(() => fileName.value.toLowerCase().endsWith('.json'))
const isMarkdownFile = computed(() => {
  const name = fileName.value.toLowerCase()
  return name.endsWith('.md') || name.endsWith('.markdown')
})
const canToggleView = computed(() => isJsonFile.value || isMarkdownFile.value)

const extension = computed(() => {
  const name = (fileName.value || '').toLowerCase()
  const idx = name.lastIndexOf('.')
  if (idx <= 0) return ''
  return name.substring(idx + 1)
})

const language = computed(() => {
  const ext = extension.value
  if (ext === 'json') return 'json'
  if (ext === 'md' || ext === 'markdown') return 'markdown'
  if (ext === 'yaml' || ext === 'yml') return 'yaml'
  if (ext === 'js' || ext === 'mjs' || ext === 'cjs') return 'javascript'
  if (ext === 'ts' || ext === 'mts' || ext === 'cts') return 'typescript'
  if (ext === 'go') return 'go'
  if (ext === 'css') return 'css'
  if (ext === 'html' || ext === 'htm') return 'html'
  if (ext === 'sh' || ext === 'bash') return 'shell'
  if (ext === 'toml') return 'toml'
  return 'plaintext'
})

const editorOptions = computed(() => {
  return {
    fontSize: 14,
    lineHeight: 22,
    tabSize: 2,
    wordWrap: 'on',
    lineNumbers: 'on',
    minimap: { enabled: true },
    scrollBeyondLastLine: false,
    automaticLayout: true,
  }
})

const fileId = computed(() => String(route.query.id ?? '').trim())
const decryptedPath = ref('')

const isEditing = computed(() => route.name === 'text-edit')
const dirty = computed(() => draft.value !== content.value)
const displayTitle = computed(() => {
  const base = fileName.value || t('view')
  if (!isEditing.value) return base
  return dirty.value ? `${base} *` : base
})
const statusText = computed(() => {
  if (!isEditing.value) return ''
  if (loading.value || error.value) return ''
  if (saving.value) return t('saving')
  if (showSavedPulse.value) return t('saved')
  return ''
})

const { mutate: writeTextFile, loading: saving, onDone: onWriteDone, onError: onWriteError } = initMutation({
  document: writeTextFileGQL,
})

async function ensureUrlTokenKey() {
  if (urlTokenKey.value) return
  if (!isLoggedIn.value) return
  try {
    const r = await apollo.a.query({ query: appGQL, fetchPolicy: 'network-only' as any })
    const newToken = r?.data?.app?.urlToken
    if (newToken) {
      urlTokenKey.value = tokenToKey(newToken)
      tempStore.app = r?.data?.app
    }
  } catch {
    // ignore
  }
}

function tryDecryptPathFromID(id: string) {
  try {
    if (!id || !urlTokenKey.value) return ''
    const bits = sjcl.codec.base64.toBits(id)
    const decrypted = chachaDecrypt(urlTokenKey.value, bits)
    if (decrypted.startsWith('{')) {
      try {
        const json = JSON.parse(decrypted)
        return json.path || ''
      } catch {
        return ''
      }
    }
    return decrypted
  } catch {
    return ''
  }
}

const canEdit = computed(() => isLoggedIn.value && !!decryptedPath.value)

const applyTextContent = async (textContent: string, resetViewMode: boolean) => {
  content.value = textContent
  draft.value = textContent

  jsonData.value = null
  renderedMarkdown.value = ''
  if (resetViewMode) {
    showRawText.value = false
  }

  if (isJsonFile.value) {
    try {
      jsonData.value = JSON.parse(textContent)
    } catch (jsonError) {
      console.error('Error parsing JSON:', jsonError)
      error.value = t('invalid_json_format')
    }
  } else if (isMarkdownFile.value) {
    try {
      renderedMarkdown.value = await render(textContent)
    } catch (markdownError) {
      console.error('Error rendering markdown:', markdownError)
      // Fallback to raw text if markdown rendering fails
    }
  }
}

const fetchTextContent = async () => {
  try {
    loading.value = true
    error.value = ''
    
    const fileId = route.query.id as string
    if (!fileId) {
      error.value = t('invalid_file_id')
      return
    }
    
    const response = await fetch(`${getApiBaseUrl()}/fs?id=${encodeURIComponent(fileId)}`)
    
    if (!response.ok) {
      error.value = response.status === 404 ? t('file_not_found') 
        : response.status === 403 ? t('access_denied') 
        : t('failed_to_load_file')
      return
    }
    
    // Extract file metadata
    const contentDisposition = response.headers.get('content-disposition')
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="?([^"]+)"?/)
      if (match) {
        try {
          fileName.value = decodeURIComponent(match[1]).replace(/[/\\:*?"<>|]+/g, '_')
        } catch (e) {
          // Ignore decode errors
        }
      }
    }
    
    const contentLength = response.headers.get('content-length')
    if (contentLength) fileSize.value = parseInt(contentLength)
    
    const lastModifiedHeader = response.headers.get('last-modified')
    if (lastModifiedHeader) lastModified.value = lastModifiedHeader
    
    const textContent = await response.text()
    await applyTextContent(textContent, true)
  } catch (err) {
    console.error('Error loading text file:', err)
    error.value = t('network_error')
  } finally {
    loading.value = false
  }
}

const retry = () => fetchTextContent()

const openEditor = () => {
  if (!canEdit.value) return
  router.push({ name: 'text-edit', query: { id: fileId.value } })
}

const openViewer = () => {
  router.push({ name: 'text-file', query: { id: fileId.value } })
}

watch(
  () => fileId.value,
  async (id) => {
    decryptedPath.value = ''
    if (!id) return
    await ensureUrlTokenKey()
    decryptedPath.value = tryDecryptPathFromID(id)
    fetchTextContent()
  },
  { immediate: true }
)

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

const toggleViewMode = () => {
  showRawText.value = !showRawText.value
}

const toggleTextWrap = () => {
  textWrap.value = !textWrap.value
}

async function save() {
  if (!canEdit.value) return
  if (!isEditing.value) return
  if (!decryptedPath.value) return
  if (saving.value) return
  if (!dirty.value) return

  const ok = await runMutation(
    writeTextFile,
    onWriteDone,
    onWriteError,
    { path: decryptedPath.value, content: draft.value, overwrite: true }
  )
  if (!ok) return

  await applyTextContent(draft.value, false)
  showSavedPulse.value = true
  if (savedPulseTimer) window.clearTimeout(savedPulseTimer)
  savedPulseTimer = window.setTimeout(() => {
    showSavedPulse.value = false
    savedPulseTimer = null
  }, 1500)
}

function onKeyDown(e: KeyboardEvent) {
  if (!isEditing.value) return
  if (!e.ctrlKey && !e.metaKey) return
  if (e.altKey) return
  if (e.key !== 's' && e.key !== 'S') return
  e.preventDefault()
  e.stopPropagation()
  save()
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown, { capture: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown, { capture: true } as any)
  if (savedPulseTimer) window.clearTimeout(savedPulseTimer)
})

watch([fileName, dirty, isEditing], () => {
  document.title = displayTitle.value
})
</script>

<style scoped>
.page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--md-sys-color-surface);
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
  background: var(--md-sys-color-surface);
}

.title-wrap {
  flex: 1;
  min-width: 0;
}

.title {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--md-sys-color-on-surface);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meta {
  display: flex;
  gap: 8px;
  margin-top: 2px;
  color: var(--md-sys-color-on-surface-variant);
  font-size: 0.8rem;
  flex-wrap: wrap;
  min-height: 1em;
}

.meta span:not(:last-child)::after {
  content: '•';
  margin-left: 8px;
  color: var(--md-sys-color-outline);
}

.actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.action-btn {
  white-space: nowrap;
}

.status {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--md-sys-color-on-surface-variant);
  font-size: 0.85rem;
  white-space: nowrap;
}

.status-icon {
  font-size: 18px;
  color: var(--md-sys-color-primary);
}

.status.saving .status-icon {
  display: none;
}

.status-text {
  line-height: 1;
}

.main {
  flex: 1;
  min-height: 0;
  display: flex;
}

.editor {
  flex: 1;
  min-width: 0;
  min-height: 0;
}

.viewer {
  flex: 1;
  min-width: 0;
  overflow: auto;
  padding: 20px;
  background: var(--md-sys-color-surface);
}

.viewer-card {
  max-width: 1200px;
  margin: 0 auto;
  background: var(--md-sys-color-surface-container-lowest);
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.text-view {
  color: var(--md-sys-color-on-surface);
  white-space: pre;
  word-wrap: normal;
  margin: 0;
  overflow-x: auto;
}

.text-view.text-wrap {
  white-space: pre-wrap;
  word-wrap: break-word;
}

.state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  text-align: center;
}

.state-text {
  color: var(--md-sys-color-on-surface-variant);
  font-size: 0.875rem;
}

.state.error .state-icon {
  font-size: 48px;
  color: var(--md-sys-color-error);
}

.state.error .state-text {
  color: var(--md-sys-color-error);
  max-width: 460px;
}

@media (max-width: 768px) {
  .topbar {
    padding: 10px 12px;
  }
  .viewer {
    padding: 16px;
  }
  .viewer-card {
    padding: 16px;
  }
}
</style>