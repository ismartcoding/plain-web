<template>
  <div class="share-page">
    <div class="top-app-bar share-top-bar">
      <div class="title">
        <v-icon-button v-if="currentPath" v-tooltip="$t('back')" @click="goUp">
          <i-material-symbols:arrow-back-rounded />
        </v-icon-button>
        <div class="breadcrumb">
          <a href="#" @click.prevent="navigateTo('')">{{ shareTitle }}</a>
          <template v-for="(crumb, i) in breadcrumbs" :key="i">
            <span class="sep">/</span>
            <a v-if="i < breadcrumbs.length - 1" href="#" @click.prevent="navigateTo(crumb.path)">{{ crumb.name }}</a>
            <span v-else class="crumb-current">{{ crumb.name }}</span>
          </template>
        </div>
        <span v-if="info?.readOnly" class="status-badge">{{ $t('share_read_only') }}</span>
      </div>
      <div v-if="info?.expiresAt" class="actions">
        <span class="expiry">{{ $t('share_expires_on', { date: formatDateTime(new Date(info.expiresAt).toISOString()) }) }}</span>
      </div>
    </div>

    <div class="share-body">
      <div v-if="state === 'loading'" class="share-center">
        <span class="spinner" />
      </div>

      <div v-else-if="state === 'error'" class="share-center share-message">
        <h3>{{ errorTitle }}</h3>
        <p>{{ errorTip }}</p>
        <v-outlined-button v-if="errorCode !== 'invalid_link'" @click="load">
          <i-material-symbols:refresh-rounded /> {{ $t('retry') }}
        </v-outlined-button>
      </div>

      <template v-else>
        <div v-if="entries.length === 0" class="share-center share-message">
          <h3>{{ $t('share_empty') }}</h3>
          <p>{{ $t('share_empty_tip') }}</p>
        </div>
        <div v-else class="file-list">
          <div v-for="entry in entries" :key="entry.virtualPath" class="file-item" @click="onItemClick(entry)">
            <div class="image">
              <FileThumb
                :is-dir="entry.isDir"
                :thumb-url="entry.hasThumb ? thumbSrc(entry) : ''"
                :extension="entryExt(entry)"
                :thumb-error="thumbErrorIds.includes(entry.virtualPath)"
                :ext-error="extErrorIds.includes(entryExt(entry))"
                :on-thumb-error="() => onThumbError(entry.virtualPath)"
                :on-ext-error="() => onExtError(entryExt(entry))"
              />
            </div>
            <div class="title">
              {{ entry.name }}
              <OnlinePreviewIcon :name="entry.name" :is-dir="entry.isDir" />
            </div>
            <div class="subtitle">{{ entry.isDir ? $t('folder') : formatFileSize(entry.size) }}</div>
            <div class="actions">
              <v-icon-button v-tooltip="$t('download')" @click.stop="downloadEntry(entry)">
                <i-material-symbols:download-rounded />
              </v-icon-button>
            </div>
          </div>
        </div>
      </template>
    </div>

    <lightbox />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { formatFileSize, formatDateTime } from '@/lib/format'
import { download, getFileExtension } from '@/lib/api/file'
import { canView } from '@/lib/file'
import type { ISource } from '@/components/lightbox/types'
import { useOpenMedia } from '@/hooks/open-media'
import { useFileOpen } from '@/hooks/file-open'
import { openUrl } from '@/lib/browser'
import {
  guestFetch,
  getSharedDirUrl,
  getSharedFileId,
  getSharedFileUrl,
  sharedTokenToKey,
  sharedInfoGQL,
  type SharedFile,
  type SharedInfo,
} from '@/lib/api/guest'

type ErrorCode =
  | 'invalid_link'
  | 'unauthorized'
  | 'forbidden'
  | 'expired'
  | 'not_found'
  | 'password_required'
  | 'network'
  | 'error'

const route = useRoute()
const { t } = useI18n()

const sharedId = computed(() => String(route.params.sharedId || ''))
const sharedToken = computed(() => route.hash.replace(/^#/, ''))

const state = ref<'loading' | 'error' | 'ready'>('loading')
const errorCode = ref<ErrorCode>('error')
const info = ref<SharedInfo | null>(null)
const entries = ref<SharedFile[]>([])
const currentPath = ref('')
const thumbErrorIds = ref<string[]>([])
const extErrorIds = ref<string[]>([])

const key = computed(() => (sharedToken.value ? sharedTokenToKey(sharedToken.value) : null))
const shareTitle = computed(() => info.value?.name || t('shared_files'))

const breadcrumbs = computed(() => {
  if (!currentPath.value) return []
  return currentPath.value.split('/').map((name, i) => ({
    name,
    path: currentPath.value.split('/').slice(0, i + 1).join('/'),
  }))
})

const errorTitle = computed(() => t(`share_error_${errorCode.value}_title`))
const errorTip = computed(() => t(`share_error_${errorCode.value}_tip`))

function entryExt(entry: SharedFile): string {
  return getFileExtension(entry.name)
}

function thumbSrc(entry: SharedFile): string {
  return getSharedFileUrl(info.value!.urlToken, sharedId.value, entry.virtualPath, '&w=96&h=96')
}

function onThumbError(virtualPath: string) {
  thumbErrorIds.value.push(virtualPath)
}

function onExtError(ext: string) {
  extErrorIds.value.push(ext)
}

function mapGraphqlError(message: string): ErrorCode {
  const m = message.toLowerCase()
  if (m.includes('expired') || m.includes('inactive')) return 'expired'
  if (m.includes('not found')) return 'not_found'
  if (m.includes('not allowed')) return 'forbidden'
  return 'error'
}

async function load() {
  if (!key.value) {
    errorCode.value = 'invalid_link'
    state.value = 'error'
    return
  }
  state.value = 'loading'
  try {
    const result = await guestFetch<{ sharedInfo: SharedInfo }>(
      sharedId.value,
      key.value,
      sharedInfoGQL,
      { virtualPath: currentPath.value || null },
    )
    if (result.errors?.length) {
      errorCode.value = mapGraphqlError(result.errors[0].message)
      state.value = 'error'
      return
    }
    info.value = result.data.sharedInfo
    if (info.value.requiresPassword) {
      errorCode.value = 'password_required'
      state.value = 'error'
      return
    }
    entries.value = info.value.entries
    state.value = 'ready'
  } catch (e: any) {
    const msg = e?.message || ''
    if (msg === 'unauthorized') errorCode.value = 'unauthorized'
    else if (msg === 'forbidden') errorCode.value = 'forbidden'
    else errorCode.value = 'network'
    state.value = 'error'
  }
}

function navigateTo(path: string) {
  if (path === currentPath.value) return
  currentPath.value = path
  load()
}

function goUp() {
  const parent = currentPath.value.substring(0, currentPath.value.lastIndexOf('/'))
  navigateTo(parent)
}

function fileUrl(entry: SharedFile, query: string = ''): string {
  return getSharedFileUrl(info.value!.urlToken, sharedId.value, entry.virtualPath, query)
}

const { open: openMedia } = useOpenMedia()

function toSource(entry: SharedFile): ISource {
  return { src: fileUrl(entry), path: entry.virtualPath, name: entry.name, size: entry.size, duration: 0 }
}

const { openFile } = useFileOpen<SharedFile>({
  items: entries,
  openTextFile: (entry) => {
    const fileId = getSharedFileId(info.value!.urlToken, sharedId.value, entry.virtualPath)
    openUrl(`/text-file?id=${encodeURIComponent(fileId)}&sid=${encodeURIComponent(sharedId.value)}`)
  },
  openBrowserFile: (entry) => window.open(fileUrl(entry), '_blank', 'noopener'),
  viewMedia: (list, f) => {
    const media = list.filter((it) => !it.isDir && canView(it.name)).map(toSource)
    openMedia(Math.max(0, media.findIndex((s) => s.path === f.virtualPath)), media, true)
  },
  download: downloadEntry,
})

function onItemClick(entry: SharedFile) {
  if (entry.isDir) navigateTo(entry.virtualPath)
  else openFile(entry)
}

function downloadEntry(entry: SharedFile) {
  const url = entry.isDir
    ? getSharedDirUrl(info.value!.urlToken, sharedId.value, entry.virtualPath)
    : fileUrl(entry, '&dl=1')
  download(url, entry.isDir ? `${entry.name}.zip` : entry.name)
}

onMounted(load)
watch(() => [sharedId.value, sharedToken.value], load)
</script>

<style lang="scss" scoped>
.share-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--md-sys-color-surface);
  color: var(--md-sys-color-on-surface);
  box-sizing: border-box;
}

.share-top-bar {
  flex-shrink: 0;

  .title {
    min-width: 0;
  }

  .breadcrumb {
    display: flex;
    align-items: center;
    overflow-x: auto;
    flex-wrap: nowrap;
    white-space: nowrap;
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }

    .sep {
      margin-inline: 4px;
      color: var(--md-sys-color-on-surface-variant);
    }

    a {
      color: var(--md-sys-color-primary);
      text-decoration: none;
    }

    .crumb-current {
      color: var(--md-sys-color-on-surface);
      font-weight: 500;
    }
  }

  .status-badge {
    flex-shrink: 0;
  }

  .expiry {
    font-size: 0.8rem;
    color: var(--md-sys-color-on-surface-variant);
  }
}

.share-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-block-end: 24px;
}

.share-center {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  text-align: center;
  padding: 40px 16px;
  box-sizing: border-box;
  height: 100%;

  h3 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 500;
  }

  p {
    margin: 0;
    color: var(--md-sys-color-on-surface-variant);
    font-size: 0.9rem;
    max-width: 420px;
  }
}

.spinner {
  width: 28px;
  height: 28px;
  border: 3px solid color-mix(in srgb, var(--md-sys-color-primary) 25%, transparent);
  border-top-color: var(--md-sys-color-primary);
  border-radius: 50%;
  animation: share-spin 0.8s linear infinite;
}

@keyframes share-spin {
  to {
    transform: rotate(360deg);
  }
}

.file-list {
  padding: 8px 0;
}

.file-item {
  display: grid;
  grid-template-areas:
    'image title actions'
    'image subtitle actions';
  grid-template-columns: 56px 1fr auto;
  align-items: center;
  gap: 2px 12px;
  margin: 0 16px 8px;
  padding: 8px 12px;
  border-radius: var(--pl-shape-m);
  box-sizing: border-box;
  background: var(--md-sys-color-surface-container-low);
  cursor: pointer;

  &:hover {
    background: var(--md-sys-color-surface-container-high);
  }

  .image {
    grid-area: image;
    width: 56px;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--pl-shape-m);
    overflow: hidden;
    background: var(--md-sys-color-surface-container);

    :deep(.svg) {
      width: 32px;
      height: 32px;
    }

    :deep(.image-thumb) {
      object-fit: cover;
      border-radius: 0;
    }
  }

  .title {
    grid-area: title;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .subtitle {
    grid-area: subtitle;
    font-size: 0.8rem;
    color: var(--md-sys-color-on-surface-variant);
  }

  .actions {
    grid-area: actions;
  }
}
</style>
