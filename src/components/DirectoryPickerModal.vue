<template>
  <v-modal @close="cancel">
    <template #headline>
      {{ title || $t('select_folder') }}
    </template>

    <template #content>
      <div class="picker">
        <p v-if="description" class="picker-desc">{{ description }}</p>
        <div class="hint">
          <span class="picker-current__label">{{ $t('current_path') }}:</span>
          <span class="mono picker-current__value">{{ currentDir || '-' }}</span>
        </div>
        <DirectoryBrowser
          :volumes="volumes"
          :loading-mounts="loadingMounts"
          :active-root="rootPath"
          :current-dir="currentDir"
          :can-go-up="canGoUp"
          :listing="listing"
          :dir-items="dirItems"
          :dir-name="dirName"
          :browser-min-height-px="320"
          :list-min-height-px="220"
          @select-root="selectRoot"
          @go-up="goUp"
          @enter-dir="enterDir"
        >
          <template #toolbar-actions>
            <v-icon-button v-tooltip="$t('ok')" @click.stop="chooseCurrent">
              <i-material-symbols:check-rounded />
            </v-icon-button>
          </template>
        </DirectoryBrowser>
      </div>
    </template>

    <template #actions>
      <v-outlined-button value="cancel" @click="cancel">{{ $t('cancel') }}</v-outlined-button>
      <v-filled-button value="ok" @click="chooseCurrent">{{ $t('ok') }}</v-filled-button>
    </template>
  </v-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import toast from '@/components/toaster'
import { useI18n } from 'vue-i18n'
import { filesGQL, initLazyQuery, initQuery, mountsGQL } from '@/lib/api/query'
import type { IStorageMount } from '@/lib/interfaces'
import { getFileName } from '@/lib/api/file'
import { Modal, popModal } from '@/components/modal'
import DirectoryBrowser from '@/components/DirectoryBrowser.vue'

const { t } = useI18n()

const props = defineProps({
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  initialPath: { type: String, default: '' },
})

const emit = defineEmits<{
  (e: typeof Modal.EVENT_PROMPT, path: string): void
}>()

const volumes = ref<IStorageMount[]>([]);
const loadingMounts = ref(true)
const rootPath = ref('')
const relativePath = ref('')
const dirItems = ref<string[]>([])

const normalizedInitialPath = computed(() => {
  const p = String(props.initialPath || '').trim()
  if (!p) return ''
  return p.replace(/\/+$/g, '') || '/'
})

const currentDir = computed(() => {
  const root = rootPath.value || '/'
  const rel = (relativePath.value || '').replace(/^\/+/, '')
  if (!rel) return root
  if (root === '/') return `/${rel}`.replace(/\/+/g, '/').replace(/\/+$/g, '')
  return `${root}/${rel}`.replace(/\/+/g, '/').replace(/\/+$/g, '')
})

const canGoUp = computed(() => {
  return !!rootPath.value && (relativePath.value || '').trim() !== ''
})

function selectRoot(mountPoint: string) {
  rootPath.value = mountPoint || '/'
  relativePath.value = ''
}

function normalizeRelativeFromAbs(absPath: string) {
  const root = rootPath.value || ''
  if (!root) return ''
  if (root === '/') return absPath.replace(/^\/+/, '')
  if (!absPath.startsWith(root)) return ''
  return absPath.slice(root.length).replace(/^\/+/, '')
}

function enterDir(absPath: string) {
  relativePath.value = normalizeRelativeFromAbs(absPath)
}

function goUp() {
  const rel = (relativePath.value || '').replace(/\/+$/g, '')
  const idx = rel.lastIndexOf('/')
  if (idx <= 0) {
    relativePath.value = ''
  } else {
    relativePath.value = rel.slice(0, idx)
  }
}

function dirName(path: string) {
  return getFileName(path) || path
}

function chooseCurrent() {
  emit(Modal.EVENT_PROMPT, currentDir.value)
}

function cancel() {
  popModal()
}

initQuery<{ mounts: IStorageMount[] }>({
  document: mountsGQL,
  handle: (data, error) => {
    loadingMounts.value = false
    if (error) {
      toast(t(error), 'error')
      return
    }

    volumes.value = [...(data?.mounts ?? [])].sort((a, b) => {
      const am = String(a?.mountPoint ?? '')
      const bm = String(b?.mountPoint ?? '')
      if (am === '/') return -1
      if (bm === '/') return 1
      return am.localeCompare(bm, undefined, { numeric: true })
    })

    if (!rootPath.value) {
      rootPath.value = volumes.value[0]?.mountPoint || '/'
      relativePath.value = ''
    }

    const init = normalizedInitialPath.value
    if (init) {
      const mountPoints = volumes.value
        .map((v) => String(v.mountPoint || '').trim())
        .filter((m): m is string => !!m)
      let best = ''
      for (const m of mountPoints) {
        if (m === '/' && init.startsWith('/')) {
          if (best.length < 1) best = '/'
          continue
        }
        if (m !== '/' && (init === m || init.startsWith(m + '/'))) {
          if (m.length > best.length) best = m
        }
      }
      if (best) {
        rootPath.value = best
        if (best === '/') {
          relativePath.value = init.replace(/^\/+/, '')
        } else {
          relativePath.value = init.slice(best.length).replace(/^\/+/, '')
        }
      }
    }
  },
})

const { loading: listing, fetch: fetchDirs } = initLazyQuery<{ files: Array<{ path: string; isDir: boolean }> }>({
  document: filesGQL,
  variables: () => ({
    root: currentDir.value,
    offset: 0,
    limit: 10000,
    query: '',
    sortBy: 'NAME_ASC',
  }),
  handle: (data, error) => {
    if (error) {
      dirItems.value = []
      toast(t(error), 'error')
      return
    }
    const files = (data?.files ?? []) as Array<{ path: string; isDir: boolean }>
    dirItems.value = files.filter((f) => f.isDir).map((f) => f.path)
  },
})

watch([rootPath, relativePath], () => {
  if (!rootPath.value) return
  fetchDirs()
}, { immediate: true })
</script>

<style scoped>
.picker {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: min(960px, 90vw);
}

.picker-desc {
  margin: 0;
  color: var(--md-sys-color-on-surface-variant);
}

.picker-current__label {
  color: var(--md-sys-color-on-surface-variant);
  margin-inline-end: 4px;
}

.picker-current__value {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}
</style>
