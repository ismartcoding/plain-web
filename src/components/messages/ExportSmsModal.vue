<template>
  <v-modal @close="popModal">
    <template #headline>{{ $t('export_sms') }}</template>
    <template #content>
      <div class="export-content">
        <div class="export-format-note">{{ $t('export_format_note') }}</div>
        <div class="export-format-list">
          <div
            v-for="fmt in formats"
            :key="fmt.value"
            class="export-format-item"
            @click="selectedFormat = fmt.value"
          >
            <i-material-symbols:radio-button-checked v-if="selectedFormat === fmt.value" class="radio-icon active" />
            <i-material-symbols:radio-button-unchecked v-else class="radio-icon" />
            <div class="export-format-info">
              <span class="export-format-label">{{ $t(fmt.labelKey) }}</span>
            </div>
          </div>
        </div>
        <div v-if="exporting" class="export-progress">
          <v-circular-progress indeterminate class="sm" />
          <span class="export-progress-text">{{ progressText }}</span>
        </div>
      </div>
    </template>
    <template #actions>
      <v-outlined-button @click="popModal">{{ $t('cancel') }}</v-outlined-button>
      <v-filled-button :loading="exporting" :disabled="exporting" @click="doExport">
        {{ $t('export') }}
      </v-filled-button>
    </template>
  </v-modal>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PropType } from 'vue'
import type { IMessage } from '@/lib/interfaces'
import { popModal } from '@/components/modal'
import { download, getFileUrlByPath } from '@/lib/api/file'
import { formatDateTime } from '@/lib/format'
import toast from '@/components/toaster'
import { smsGQL } from '@/lib/api/query'
import { useApolloClient } from '@vue/apollo-composable'
import type sjcl from 'sjcl'

const props = defineProps({
  /** Direct items for single-thread export. Pass empty array when using `query`. */
  items: { type: Array as PropType<IMessage[]>, default: () => [] },
  /** GraphQL query string for exporting all messages. Used when `items` is empty. */
  query: { type: String as PropType<string | null>, default: null },
  contactName: { type: String, default: '' },
  urlTokenKey: { type: Object as PropType<sjcl.BitArray | null>, default: null },
})

const { t } = useI18n()
const { resolveClient } = useApolloClient()

const formats = [
  { value: 'json', labelKey: 'export_format_json' },
  { value: 'text', labelKey: 'export_format_text' },
  { value: 'csv', labelKey: 'export_format_csv' },
]

const selectedFormat = ref('json')
const exporting = ref(false)
const progressText = ref('')
let abortController: AbortController | null = null

onUnmounted(() => {
  abortController?.abort()
})

function isSent(item: IMessage): boolean {
  return item.type === 2 || item.type === 4
}

function getDirection(item: IMessage): string {
  return isSent(item) ? t('sent') : t('received')
}

function escapeCSV(value: string): string {
  return `"${(value ?? '').replace(/"/g, '""')}"`
}

function getSafeName(): string {
  return (
    (props.contactName || (props.query !== null ? 'all_sms' : 'sms'))
      .replace(/[^\w\u4e00-\u9fa5\u3040-\u30ff]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '') || 'sms'
  )
}

async function loadMessages(): Promise<IMessage[]> {
  if (props.items.length > 0) {
    return props.items
  }
  progressText.value = t('export_loading_messages')
  const client = resolveClient('a')
  const result = await client.query({
    query: smsGQL,
    variables: { offset: 0, limit: 100000, query: props.query ?? '' },
    fetchPolicy: 'network-only',
  })
  return result.data?.sms ?? []
}

async function doExport() {
  abortController = new AbortController()
  exporting.value = true
  try {
    const raw = await loadMessages()
    const sorted = [...raw].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    await buildZip(sorted, getSafeName(), selectedFormat.value)
    popModal()
  } catch (err: any) {
    if ((err as Error)?.name !== 'AbortError') {
      toast(err?.message ?? t('failed'), 'error')
    }
    exporting.value = false
  }
}

async function buildZip(sorted: IMessage[], safeName: string, format: string) {
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()

  progressText.value = t('export_preparing_data')

  if (format === 'json') {
    const data = sorted.map((msg) => ({
      id: msg.id,
      date: msg.date,
      address: msg.address,
      type: msg.type,
      direction: getDirection(msg),
      body: msg.body ?? '',
      serviceCenter: msg.serviceCenter ?? '',
      subscriptionId: msg.subscriptionId,
      isMms: msg.isMms ?? false,
      attachmentFiles: (msg.attachments ?? []).map((a) => ({
        name: a.name,
        contentType: a.contentType,
        localPath: `attachments/${msg.id}/${a.name || a.path.split('/').pop() || 'file'}`,
      })),
      tags: (msg.tags ?? []).map((tag) => tag.name),
    }))
    zip.file('messages.json', JSON.stringify(data, null, 2))
  } else if (format === 'text') {
    const lines: string[] = []
    for (const msg of sorted) {
      const dir = isSent(msg) ? '→' : '←'
      lines.push(`[${formatDateTime(msg.date)}] ${dir} ${msg.address}`)
      if (msg.body) lines.push(msg.body)
      for (const att of msg.attachments ?? []) {
        const fileName = att.name || att.path.split('/').pop() || 'file'
        lines.push(`[attachment: attachments/${msg.id}/${fileName}]`)
      }
      lines.push('')
    }
    zip.file('messages.txt', lines.join('\n'))
  } else if (format === 'csv') {
    const header = [
      escapeCSV(t('date')),
      escapeCSV(t('direction')),
      escapeCSV(t('address')),
      escapeCSV(t('body')),
      escapeCSV(t('attachments')),
    ].join(',')
    const rows = sorted.map((msg) => {
      const attNames = (msg.attachments ?? []).map((a) => a.name || a.contentType).join('; ')
      return [
        escapeCSV(formatDateTime(msg.date)),
        escapeCSV(getDirection(msg)),
        escapeCSV(msg.address ?? ''),
        escapeCSV(msg.body ?? ''),
        escapeCSV(attNames),
      ].join(',')
    })
    zip.file('messages.csv', '\uFEFF' + header + '\n' + rows.join('\n'))
  }

  // Fetch all attachment files into attachments/{msgId}/{filename}
  const attachmentsFolder = zip.folder('attachments')!
  const totalAtt = sorted.reduce((s, m) => s + (m.attachments?.length ?? 0), 0)
  let fetchedAtt = 0

  for (const msg of sorted) {
    if (!msg.attachments?.length) continue
    const msgFolder = attachmentsFolder.folder(msg.id)!
    for (const att of msg.attachments) {
      const url = getFileUrlByPath(props.urlTokenKey, att.path)
      const fileName = att.name || att.path.split('/').pop() || `file_${fetchedAtt}`
      progressText.value = `${t('export_fetching_attachments')} ${fetchedAtt + 1}/${totalAtt}: ${fileName}`
      if (url) {
        try {
          const resp = await fetch(url, { signal: abortController!.signal })
          if (resp.ok) {
            msgFolder.file(fileName, await resp.blob())
          }
        } catch (e) {
          if ((e as Error)?.name === 'AbortError') throw e
          // skip failed attachments
        }
      }
      fetchedAtt++
    }
  }

  progressText.value = t('export_generating_zip')
  const content = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
  const blobUrl = URL.createObjectURL(content)
  download(blobUrl, `${safeName}_sms.zip`)
  setTimeout(() => URL.revokeObjectURL(blobUrl), 2000)
  exporting.value = false
  progressText.value = ''
}
</script>

<style scoped lang="scss">
.export-content {
  width: 360px;
}

.export-format-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.export-format-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 4px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: var(--md-sys-color-surface-container-high);
  }

  .radio-icon {
    flex-shrink: 0;
    font-size: 1.25rem;
    margin-top: 1px;
    color: var(--md-sys-color-on-surface-variant);

    &.active {
      color: var(--md-sys-color-primary);
    }
  }
}

.export-format-label {
  font-size: 0.9375rem;
  color: var(--md-sys-color-on-surface);
}

.export-format-note {
  margin-bottom: 12px;
  font-size: 0.75rem;
  color: var(--md-sys-color-on-surface-variant);
}

.export-progress {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
  padding: 8px 4px;
  color: var(--md-sys-color-on-surface-variant);
  font-size: 0.875rem;
}

.export-progress-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
