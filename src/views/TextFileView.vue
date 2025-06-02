<template>
  <header class="header">
    <header-actions :logged-in="false" />
  </header>
  
  <main class="main-content">
    <!-- Loading State -->
    <section v-if="loading" class="state-container">
      <md-circular-progress indeterminate />
      <span class="state-text">{{ $t('loading') }}</span>
    </section>
    
    <!-- Error State -->
    <section v-else-if="error" class="state-container error">
      <i-material-symbols:error-outline-rounded class="state-icon" />
      <span class="state-text">{{ error }}</span>
      <md-outlined-button @click="retry">{{ $t('retry') }}</md-outlined-button>
    </section>
    
    <!-- Content -->
    <article v-else class="text-content">
      <!-- File Header -->
      <header class="file-header">
        <div class="file-info">
          <h1 class="file-name">{{ fileName }}</h1>
          <div class="file-meta" v-if="fileSize || lastModified">
            <span v-if="fileSize">{{ formatFileSize(fileSize) }}</span>
            <span v-if="lastModified">{{ formatDateTime(lastModified) }}</span>
          </div>
        </div>
        
        <div class="file-actions">
          <md-outlined-button @click="downloadFile" class="action-btn">
            <i-lucide-download slot="icon" />
            {{ $t('download') }}
          </md-outlined-button>
          <md-outlined-button 
            v-if="canToggleView" 
            @click="toggleViewMode" 
            class="action-btn"
          >
            <i-lucide-eye v-if="showRawText" slot="icon" />
            <i-lucide-code v-else slot="icon" />
            {{ showRawText ? $t('formatted_view') : $t('raw_text') }}
          </md-outlined-button>
        </div>
      </header>
      
      <!-- Content Display -->
      <section class="content-display">
        <pre v-if="showRawText || (!isJsonFile && !isMarkdownFile)" class="text-view">{{ content }}</pre>
        <json-viewer v-else-if="isJsonFile" :value="jsonData" :expand-depth="2" />
        <div v-else-if="isMarkdownFile" class="md-container" v-html="renderedMarkdown"></div>
      </section>
    </article>
  </main>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { getApiBaseUrl } from '@/lib/api/api'
import { formatFileSize, formatDateTime } from '@/lib/format'
import { useMarkdown } from '@/hooks/markdown'
import { useTempStore } from '@/stores/temp'
import JsonViewer from '@/components/jsonviewer/json-viewer.vue'

const { t } = useI18n()
const route = useRoute()
const tempStore = useTempStore()
const { app, urlTokenKey } = storeToRefs(tempStore)

// Reactive state
const loading = ref(true)
const error = ref('')
const content = ref('')
const fileName = ref('')
const fileSize = ref(0)
const lastModified = ref('')
const jsonData = ref<any>(null)
const renderedMarkdown = ref('')
const showRawText = ref(false)

const { render } = useMarkdown(app, urlTokenKey)

// Computed properties
const isJsonFile = computed(() => fileName.value.toLowerCase().endsWith('.json'))
const isMarkdownFile = computed(() => {
  const name = fileName.value.toLowerCase()
  return name.endsWith('.md') || name.endsWith('.markdown')
})
const canToggleView = computed(() => isJsonFile.value || isMarkdownFile.value)

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
    content.value = textContent
    
    // Reset display states
    jsonData.value = null
    renderedMarkdown.value = ''
    showRawText.value = false
    
    // Process content based on file type
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
  } catch (err) {
    console.error('Error loading text file:', err)
    error.value = t('network_error')
  } finally {
    loading.value = false
  }
}

const retry = () => fetchTextContent()

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

// Lifecycle and watchers
onMounted(fetchTextContent)
watch(fileName, () => {
  if (fileName.value) document.title = fileName.value
})
</script>

<style scoped>
.header {
  display: flex;
  justify-content: end;
  margin-top: 6px;
  padding-right: 16px;
}

.main-content {
  padding: 20px 20px 20px;
  max-width: 1200px;
  margin: 0 auto;
  min-height: 100vh;
}

/* State containers for loading and error */
.state-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 50vh;
  gap: 16px;
  text-align: center;
}

.state-container.error .state-icon {
  font-size: 48px;
  color: var(--md-sys-color-error);
}

.state-container.error .state-text {
  color: var(--md-sys-color-error);
  max-width: 400px;
}

.state-text {
  color: var(--md-sys-color-on-surface-variant);
  font-size: 0.875rem;
}

/* Content styles */
.text-content {
  animation: fadeIn 0.3s ease-in;
}

.file-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
  flex-wrap: wrap;
}

.file-info {
  flex: 1;
  min-width: 0;
}

.file-name {
  margin: 0 0 8px 0;
  font-size: 1.5rem;
  font-weight: 500;
  color: var(--md-sys-color-on-surface);
  word-break: break-all;
}

.file-meta {
  display: flex;
  gap: 16px;
  color: var(--md-sys-color-on-surface-variant);
  font-size: 0.875rem;
  flex-wrap: wrap;
}

.file-meta span:not(:last-child)::after {
  content: '•';
  margin-left: 16px;
  color: var(--md-sys-color-outline);
}

.file-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-shrink: 0;
  flex-wrap: wrap;
}

.action-btn {
  white-space: nowrap;
}

/* Content display */
.content-display {
  background-color: var(--md-sys-color-surface);
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.text-view {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 0.875rem;
  line-height: 1.6;
  color: var(--md-sys-color-on-surface);
  white-space: pre-wrap;
  word-wrap: break-word;
  margin: 0;
  overflow-x: auto;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Responsive design */
@media (max-width: 768px) {
  .main-content {
    padding: 20px 16px 16px;
  }
  
  .file-name {
    font-size: 1.25rem;
  }
  
  .content-display {
    padding: 16px;
  }
  
  .text-view {
    font-size: 0.8rem;
  }
  
  .file-meta {
    flex-direction: column;
    gap: 4px;
  }
  
  .file-meta span:not(:last-child)::after {
    display: none;
  }
  
  .file-header {
    flex-direction: column;
    align-items: stretch;
  }
  
  .file-actions {
    justify-content: stretch;
    width: 100%;
  }
  
  .action-btn {
    flex: 1;
  }
}

@media (max-width: 480px) {
  .main-content {
    padding: 20px 12px 12px;
  }
  
  .content-display {
    padding: 12px;
  }
}
</style> 