<template>
  <div class="top-app-bar">
    <v-checkbox touch-target="wrapper" :checked="allChecked" :indeterminate="!allChecked && checked" @change="toggleAllChecked" />
    <div class="title">
      <span v-if="selectedIds.length">{{ $t('x_selected', { count: realAllChecked ? total.toLocaleString() : selectedIds.length.toLocaleString() }) }}</span>
      <span v-else>{{ $t('page_title.apps') }} ({{ total.toLocaleString() }})</span>
      <template v-if="checked">
        <button v-tooltip="$t('download')" class="btn-icon" @click.stop="downloadItems(realAllChecked, selectedIds, q)">
          
          <i-material-symbols:download-rounded />
        </button>
      </template>
    </div>
    <div class="actions">
      <search-input :filter="filter" :types="types" :get-url="getUrl" />
      <button v-tooltip="$t('install_app')" class="btn-icon" @click.stop="install">
        
        <i-material-symbols:upload-rounded />
      </button>
      <v-dropdown v-model="sortMenuVisible">
        <template #trigger>
                  <button v-tooltip="$t('sort')" class="btn-icon btn-sort" :disabled="sorting">
          
          <v-circular-progress v-if="sorting" indeterminate />
          <i-material-symbols:sort-rounded v-else />
        </button>
        </template>
        <div class="menu-items">
          <div
            v-for="item in sortItems"
            :key="item.value"
            class="dropdown-item"
            :class="{ selected: item.value === appSortBy }"
            @click="sort(item.value)"
          >
            {{ $t(item.label) }}
          </div>
        </div>
      </v-dropdown>
    </div>
  </div>
  <all-checked-alert
    :limit="limit"
    :total="total"
    :all-checked-alert-visible="allCheckedAlertVisible"
    :real-all-checked="realAllChecked"
    :select-real-all="selectRealAll"
    :clear-selection="clearSelection"
  />
  <div class="scroll-content" @dragover.stop.prevent="fileDragEnter">
    <div v-show="dropping" class="drag-mask" @drop.stop.prevent="dropApkFiles" @dragleave.stop.prevent="fileDragLeave">{{ $t('release_to_send_files') }}</div>
    <div class="app-list" :class="{ 'select-mode': checked }">
      <section
        v-for="(item, i) in items"
        :key="item.id"
        class="app-item selectable-card"
        :class="{ selected: selectedIds.includes(item.id), selecting: shiftEffectingIds.includes(item.id) }"
        @click.stop="handleItemClick($event, item, i, () => {})"
        @mouseover="handleMouseOver($event, i)"
      >
        <div class="start">
          <v-checkbox v-if="shiftEffectingIds.includes(item.id)" class="checkbox" touch-target="wrapper" :checked="shouldSelect" @click.stop="toggleSelect($event, item, i)" />
          <v-checkbox v-else class="checkbox" touch-target="wrapper" :checked="selectedIds.includes(item.id)" @click.stop="toggleSelect($event, item, i)" />
          <span class="number"><field-id :id="i + 1" :raw="item" /></span>
        </div>
        <img class="image" width="50" height="50" :src="item.icon" />
        <div class="title">{{ item.name }} ({{ item.version }})</div>
        <div class="subtitle">
          <span>{{ item.id }}</span>
          <span>{{ formatFileSize(item.size) }}</span>
          <span>{{ $t('app_type.' + item.type) }}</span>
        </div>
        <div class="actions">
          <template v-if="item.isUninstalling">
            <v-circular-progress v-tooltip="$t('uninstalling')" indeterminate class="sm" />
            &nbsp;<v-outlined-button class="btn-sm" @click.stop="cancelUninstall(item)">{{ $t('cancel') }}</v-outlined-button>
          </template>
          <button v-else v-tooltip="$t('uninstall')" class="btn-icon sm" @click.stop="uninstall(item)">
            
            <i-material-symbols:delete-forever-outline-rounded />
          </button>
          <button v-tooltip="$t('download')" class="btn-icon sm" @click.stop="downloadFile(item.path, `${item.name.replace(' ', '')}-${item.id}.apk`)">
            
            <i-material-symbols:download-rounded />
          </button>
        </div>
        <div class="time">
          <span v-tooltip="formatDateTimeFull(item.installedAt)">{{ $t('installed_at') }}: {{ formatDateTime(item.installedAt) }} </span>
          <span v-tooltip="formatDateTimeFull(item.updatedAt)">{{ $t('updated_at') }}: {{ formatDateTime(item.updatedAt) }} </span>
        </div>
      </section>
      <template v-if="loading && items.length === 0">
        <section v-for="i in 20" :key="i" class="app-item selectable-card-skeleton">
          <div class="start">
            <div class="checkbox">
              <div class="skeleton-checkbox"></div>
            </div>
            <span class="number">{{ i }}</span>
          </div>
          <div class="image">
            <div class="skeleton-image"></div>
          </div>
          <div class="title">
            <div class="skeleton-text skeleton-title"></div>
          </div>
          <div class="subtitle">
            <div class="skeleton-text skeleton-subtitle"></div>
          </div>
          <div class="actions">
            <div class="skeleton-text skeleton-actions"></div>
          </div>
          <div class="time">
            <div class="skeleton-text skeleton-time"></div>
            <div class="skeleton-text skeleton-time"></div>
          </div>
        </section>
      </template>
    </div>
    <div v-if="!loading && items.length === 0" class="no-data-placeholder">
      {{ $t(noDataKey(loading)) }}
    </div>
    <v-pagination v-if="total > limit" :page="page" :go="gotoPage" :total="total" :limit="limit" />
    <input ref="fileInput" style="display: none" type="file" accept=".apk" multiple @change="uploadChanged" />
  </div>
</template>

<script setup lang="ts">
import { onActivated, onDeactivated, reactive, ref } from 'vue'
import toast from '@/components/toaster'
import tapPhone from '@/plugins/tapphone'
import { formatDateTime, formatDateTimeFull, formatFileSize } from '@/lib/format'
import { packagesGQL, initLazyQuery, packageStatusesGQL } from '@/lib/api/query'
import { useRoute } from 'vue-router'
import { replacePath } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import { useI18n } from 'vue-i18n'
import { noDataKey } from '@/lib/list'
import type { IFilter, IPackageItem, IPackage, IPackageStatus } from '@/lib/interfaces'
import { decodeBase64 } from '@/lib/strutil'
import { useSelectable } from '@/hooks/list'
import { initMutation, uninstallPackageGQL, installPackageGQL } from '@/lib/api/mutation'
import { useTempStore, type IUploadItem } from '@/stores/temp'
import { storeToRefs } from 'pinia'
import { useDownload, useDownloadItems } from '@/hooks/files'
import { useFileUpload, useDragDropUpload } from '@/hooks/upload'
import { deleteById } from '@/lib/array'
import emitter from '@/plugins/eventbus'
import { DataType } from '@/lib/data'
import { getFileUrlByPath } from '@/lib/api/file'
import { useSearch } from '@/hooks/search'
import { useKeyEvents } from '@/hooks/key-events'
import { getSortItems } from '@/lib/file'
import { generateDownloadFileName } from '@/lib/format'
import Dropdown from '@/components/base/VDropdown.vue'

// Track packages being installed
const installingPackages = ref<{ id: string; updatedAt: string; isNew: boolean }[]>([])

const { app, urlTokenKey, uploads } = storeToRefs(useTempStore())
const { input: fileInput, upload: uploadFiles, uploadChanged } = useFileUpload(uploads)
const { dropping, fileDragEnter, fileDragLeave, dropFiles } = useDragDropUpload(uploads)

const mainStore = useMainStore()
const items = ref<IPackageItem[]>([])
const { t } = useI18n()
const { appSortBy } = storeToRefs(mainStore)
const { parseQ } = useSearch()
const filter = reactive<IFilter>({
  tagIds: [],
})
const sortItems = getSortItems()
const sorting = ref(false)

const route = useRoute()
const query = route.query
const page = ref(parseInt(query.page?.toString() ?? '1'))
const limit = 50
const q = ref('')

const {
  selectedIds,
  allChecked,
  realAllChecked,
  selectRealAll,
  allCheckedAlertVisible,
  clearSelection,
  toggleAllChecked,
  toggleSelect,
  total,
  checked,
  shiftEffectingIds,
  handleItemClick,
  handleMouseOver,
  selectAll,
  shouldSelect,
} = useSelectable(items)
const { downloadItems } = useDownloadItems(urlTokenKey, DataType.PACKAGE, clearSelection, () => generateDownloadFileName('apps'))
const { downloadFile } = useDownload(urlTokenKey)
const gotoPage = (page: number) => {
  const q = route.query.q
  replacePath(mainStore, q ? `/apps?page=${page}&q=${q}` : `/apps?page=${page}`)
}
const { keyDown: pageKeyDown, keyUp: pageKeyUp } = useKeyEvents(total, limit, page, selectAll, clearSelection, gotoPage, () => {})

const install = () => {
  uploadFiles(app.value.downloadsDir)
}

const { mutate: installPackageMutate } = initMutation({
  document: installPackageGQL,
})

const types = ['user', 'system'].map((it) => ({ id: it, name: t('app_type.' + it) }))

const cancelUninstall = (item: IPackageItem) => {
  item.isUninstalling = false
}

const { loading, fetch } = initLazyQuery({
  handle: (data: { packages: IPackage[]; packageCount: number }, error: string) => {
    sorting.value = false
    if (error) {
      toast(t(error), 'error')
    } else {
      if (data) {
        items.value = data.packages.map((it: IPackage) => ({
          ...it,
          isUninstalling: false,
          icon: getFileUrlByPath(urlTokenKey.value, 'pkgicon://' + it.id),
        }))
        total.value = data.packageCount
      }
    }
  },
  document: packagesGQL,
  variables: () => ({
    offset: (page.value - 1) * limit,
    limit,
    query: q.value,
    sortBy: appSortBy.value,
  }),
})

function getUrl(q: string) {
  return q ? `/apps?q=${q}` : `/apps`
}

const sortMenuVisible = ref(false)

function sort(value: string) {
  if (appSortBy.value === value) {
    sortMenuVisible.value = false
    return
  }
  sorting.value = true
  appSortBy.value = value
  gotoPage(1)
  sortMenuVisible.value = false
}

const { mutate: uninstallMutate } = initMutation({
  document: uninstallPackageGQL,
})

function uninstall(item: IPackageItem) {
  item.isUninstalling = true
  tapPhone(t('confirm_uninstallation_on_phone'))
  uninstallMutate({ id: item.id })
}

const { loading: fetchPackageStatusLoading, fetch: fetchPackageStatus } = initLazyQuery({
  handle: (data: { packageStatuses: IPackageStatus[] }) => {
    if (data) {
      // Handle uninstalling packages
      for (const item of data.packageStatuses) {
        const installingPackage = installingPackages.value.find((it) => it.id === item.id)
        if (installingPackage) {
          const isNewInstalled = installingPackage.isNew && item.exist
          const isUpgraded = !installingPackage.isNew && item.exist && installingPackage.updatedAt < item.updatedAt
          if (isNewInstalled || isUpgraded) {
              installingPackages.value = installingPackages.value.filter((it) => it.id !== item.id)
              tapPhone('')
              if (isNewInstalled) {
                toast(t('app_installation_completed'), 'success')
              } else {
                toast(t('app_upgrade_completed'), 'success')
              }
              fetch()
          }
        } else if (!item.exist) {
          // Package was uninstalled
          deleteById(items.value as any, item.id)
          tapPhone('')
        }
      }
    }
  },
  document: packageStatusesGQL,
  variables: () => ({
    ids: [...items.value.filter((it) => it.isUninstalling).map((it) => it.id), ...installingPackages.value.map((it) => it.id)],
  }),
})

const uploadTaskDoneHandler = (r: IUploadItem) => {
  if (r.status === 'done') {
    installPackageMutate({ path: r.dir + '/' + r.fileName })
      .then((result) => {
        tapPhone(t('confirm_installation_on_phone'))

        if (result && result.data && result.data.installPackage) {
          const { packageName, updatedAt, isNew } = result.data.installPackage

          if (packageName) {
            // Add to installing packages
            installingPackages.value.push({ id: packageName, updatedAt, isNew })

            // Set a timeout to remove the packageId from installing list after 60 seconds
            setTimeout(() => {
              if (installingPackages.value.some((it) => it.id === packageName)) {
                installingPackages.value = installingPackages.value.filter((it) => it.id !== packageName)
                tapPhone('')
              }
            }, 120000)
          }
        }
      })
      .catch((error) => {
        tapPhone('')
        toast(t('app_installation_failed') + ': ' + error.message, 'error')
      })
  }
}

function dropApkFiles(e: DragEvent) {
  dropFiles(e, app.value.downloadsDir, (file) => file.name.endsWith('.apk'))
}

onActivated(() => {
  setInterval(() => {
    if ((items.value.some((it) => it.isUninstalling) || installingPackages.value.length > 0) && !fetchPackageStatusLoading.value) {
      fetchPackageStatus()
    }
  }, 1000)
  q.value = decodeBase64(query.q?.toString() ?? '')
  parseQ(filter, q.value)
  fetch()
  emitter.on('upload_task_done', uploadTaskDoneHandler)
  window.addEventListener('keydown', pageKeyDown)
  window.addEventListener('keyup', pageKeyUp)
})

onDeactivated(() => {
  emitter.off('upload_task_done', uploadTaskDoneHandler)
  window.removeEventListener('keydown', pageKeyDown)
  window.removeEventListener('keyup', pageKeyUp)
})
</script>
<style scoped lang="scss">
.app-item {
  display: grid;
  border-radius: 8px;
  grid-template-areas:
    'start image title actions time'
    'start image subtitle  actions time';
  grid-template-columns: 48px 50px 2fr 1fr minmax(200px, auto);
  .start {
    grid-area: start;
  }
  .number {
    font-size: 0.75rem;
    display: flex;
    justify-content: center;
  }
  .image {
    width: 50px;
    height: 50px;
    grid-area: image;
    object-fit: cover;
    border-radius: 8px;
    margin-block: 12px;
  }
  .title {
    grid-area: title;
    font-weight: 500;
    margin-inline: 16px;
    padding-block-start: 12px;
    word-break: break-all;
  }
  .subtitle {
    grid-area: subtitle;
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    font-size: 0.875rem;
    margin-inline: 16px;
  }
  .actions {
    grid-area: actions;
    display: flex;
    flex-direction: row;
    gap: 4px;
    align-items: center;
    visibility: visible;
    padding-inline: 16px;
  }
  .time {
    grid-area: time;
    display: flex;
    flex-direction: column;
    padding-inline: 16px;
    justify-content: center;
    align-items: end;
    gap: 8px;
    font-size: 0.875rem;
  }
}
.app-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.app-list.select-mode {
  .media-item {
    .actions {
      visibility: hidden;
    }
  }
}
.app-list {
  .app-item {
    .skeleton-image {
      width: 50px;
      height: 50px;
    }
    .skeleton-title {
      width: 40%;
      height: 24px;
    }
    .skeleton-subtitle {
      width: 50%;
      height: 20px;
    }
    .skeleton-actions {
      width: 140px;
      height: 20px;
    }
    .skeleton-time {
      width: 60px;
      height: 20px;
    }
  }
}
</style>
