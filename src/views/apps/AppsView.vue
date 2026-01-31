<template>
  <div class="top-app-bar">
    <v-checkbox touch-target="wrapper" :checked="allChecked" :indeterminate="!allChecked && checked" @change="toggleAllChecked" />
    <div class="title">
      <span v-if="selectedIds.length">{{ $t('x_selected', { count: realAllChecked ? total.toLocaleString() : selectedIds.length.toLocaleString() }) }}</span>
      <span v-else>{{ $t('page_title.apps') }} ({{ total.toLocaleString() }})</span>
      <template v-if="checked">
        <v-icon-button v-tooltip="$t('download')" @click.stop="downloadItems(realAllChecked, selectedIds, q)">
          <i-material-symbols:download-rounded />
        </v-icon-button>
      </template>
    </div>

    <div v-if="!isPhone || !checked" class="actions">
      <AppsActionButtons
        :sorting="sorting"
        :sort-items="sortItems"
        :app-sort-by="appSortBy"
        @install="install"
        @sort="sort"
      />
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
    <div class="main-list" :class="{ 'select-mode': checked }">
      <AppListItem
        v-for="(item, i) in items"
        :key="item.id"
        :item="item"
        :index="i"
        :selected-ids="selectedIds"
        :shift-effecting-ids="shiftEffectingIds"
        :should-select="shouldSelect"
        :is-phone="isPhone"
        :handle-item-click="handleItemClick"
        :handle-mouse-over="handleMouseOver"
        :toggle-select="toggleSelect"
        @uninstall="uninstall"
        @download="downloadApp"
        @cancel-uninstall="cancelUninstall"
      />
      <template v-if="loading && items.length === 0">
        <AppSkeletonItem
          v-for="i in 20"
          :key="i"
          :index="i"
          :is-phone="isPhone"
        />
      </template>
    </div>
    <div v-if="!loading && items.length === 0" class="no-data-placeholder">
      {{ $t(noDataKey(loading, app.permissions, 'QUERY_ALL_PACKAGES')) }}
    </div>
    <v-pagination v-if="total > limit" :page="page" :go="gotoPage" :total="total" :limit="limit" />
    <input ref="fileInput" style="display: none" type="file" accept=".apk" multiple @change="uploadChanged" />
  </div>
</template>

<script setup lang="ts">
import { onActivated, onDeactivated, ref, inject, watch } from 'vue'
import toast from '@/components/toaster'
import tapPhone from '@/plugins/tapphone'
import { packagesGQL, initLazyQuery, packageStatusesGQL } from '@/lib/api/query'
import { useRoute } from 'vue-router'
import { replacePath } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import { useI18n } from 'vue-i18n'
import { noDataKey } from '@/lib/list'
import type { IPackageItem, IPackage, IPackageStatus } from '@/lib/interfaces'
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
import { useKeyEvents } from '@/hooks/key-events'
import { getSortItems } from '@/lib/file'
import { generateDownloadFileName } from '@/lib/format'
import AppsActionButtons from '@/components/apps/AppsActionButtons.vue'
import AppSkeletonItem from '@/components/apps/AppSkeletonItem.vue'
import AppListItem from '@/components/apps/AppListItem.vue'

const isPhone = inject('isPhone') as boolean

// Track packages being installed
const installingPackages = ref<{ id: string; updatedAt: string; isNew: boolean }[]>([])

const { app, urlTokenKey, uploads } = storeToRefs(useTempStore())
const { input: fileInput, upload: uploadFiles, uploadChanged } = useFileUpload(uploads)
const { dropping, fileDragEnter, fileDragLeave, dropFiles } = useDragDropUpload(uploads)

const mainStore = useMainStore()
const items = ref<IPackageItem[]>([])
const { t } = useI18n()
const { appSortBy } = storeToRefs(mainStore)
const sortItems = getSortItems()
const sorting = ref(false)

const route = useRoute()
const page = ref(parseInt(route.query.page?.toString() ?? '1'))
const limit = 50
const q = ref('')
const isActive = ref(false)
let statusInterval: number | undefined

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

function sort(value: string) {
  if (appSortBy.value === value) {
    return
  }
  sorting.value = true
  appSortBy.value = value
  gotoPage(1)
}

function applyRouteQuery() {
  if (!isActive.value) return
  page.value = parseInt(route.query.page?.toString() ?? '1')
  q.value = decodeBase64(route.query.q?.toString() ?? '')
  fetch()
}

const { mutate: uninstallMutate } = initMutation({
  document: uninstallPackageGQL,
})

function uninstall(item: IPackageItem) {
  item.isUninstalling = true
  tapPhone(t('confirm_uninstallation_on_phone'))
  uninstallMutate({ id: item.id })
}

function downloadApp(item: IPackageItem) {
  downloadFile(item.path, `${item.name.replace(' ', '')}-${item.id}.apk`)
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
                toast(t('app_installation_completed'))
              } else {
                toast(t('app_upgrade_completed'))
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
  isActive.value = true

  if (statusInterval) {
    clearInterval(statusInterval)
    statusInterval = undefined
  }
  statusInterval = window.setInterval(() => {
    if ((items.value.some((it) => it.isUninstalling) || installingPackages.value.length > 0) && !fetchPackageStatusLoading.value) {
      fetchPackageStatus()
    }
  }, 1000)

  applyRouteQuery()
  emitter.on('upload_task_done', uploadTaskDoneHandler)
  window.addEventListener('keydown', pageKeyDown)
  window.addEventListener('keyup', pageKeyUp)
})

onDeactivated(() => {
  isActive.value = false
  if (statusInterval) {
    clearInterval(statusInterval)
    statusInterval = undefined
  }
  emitter.off('upload_task_done', uploadTaskDoneHandler)
  window.removeEventListener('keydown', pageKeyDown)
  window.removeEventListener('keyup', pageKeyUp)
})

watch(
  () => route.fullPath,
  () => {
    applyRouteQuery()
  }
)
</script>
<style scoped lang="scss">
:deep(.app-item) {
  grid-template-areas:
    'start image title actions time'
    'start image subtitle  actions time';
  grid-template-columns: 48px 50px 2fr 1fr minmax(240px, auto);
  .image {
    width: 50px;
    height: 50px;
    grid-area: image;
    object-fit: cover;
    border-radius: 8px;
    margin-block: 12px;
  }
  .title {
    margin-inline: 16px;
    padding-block-start: 12px;
  }
  .subtitle {
    grid-area: subtitle;
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    font-size: 0.875rem;
    margin-inline: 16px;
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
</style>
