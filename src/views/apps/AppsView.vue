<template>
  <div class="top-app-bar">
    <md-checkbox touch-target="wrapper" @change="toggleAllChecked" :checked="allChecked" :indeterminate="!allChecked && checked" />
    <div class="title">
      <span v-if="selectedIds.length">{{ $t('x_selected', { count: realAllChecked ? total.toLocaleString() : selectedIds.length.toLocaleString() }) }}</span>
      <span v-else>{{ $t('page_title.apps') }} ({{ total.toLocaleString() }})</span>
      <template v-if="checked">
        <button class="btn-icon" @click.stop="downloadItems(realAllChecked, selectedIds, q)" v-tooltip="$t('download')">
          <md-ripple />
          <i-material-symbols:download-rounded />
        </button>
      </template>
    </div>
    <div class="actions">
      <search-input :filter="filter" :types="types" :get-url="getUrl" />
      <button class="btn-icon" @click.stop="install" style="display: none">
        <md-ripple />
        {{ $t('install') }}
      </button>
      <popper>
        <button class="btn-icon btn-sort" v-tooltip="$t('sort')">
          <md-ripple />
          <i-material-symbols:sort-rounded />
        </button>
        <template #content="slotProps">
          <div class="menu-items">
            <md-menu-item v-for="item in sortItems" @click="sort(slotProps, item.value)" :key="item.value" :selected="item.value === appSortBy">
              <div slot="headline">{{ $t(item.label) }}</div>
            </md-menu-item>
          </div>
        </template>
      </popper>
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
  <div class="scroll-content">
    <div class="app-list" :class="{ 'select-mode': checked }">
      <section
        class="app-item selectable-card"
        v-for="(item, i) in items"
        :key="item.id"
        :class="{ selected: selectedIds.includes(item.id), selecting: shiftEffectingIds.includes(item.id) }"
        @click.stop="handleItemClick($event, item, i, () => {})"
        @mouseover="handleMouseOver($event, i)"
      >
        <div class="start">
          <md-checkbox v-if="shiftEffectingIds.includes(item.id)" class="checkbox" touch-target="wrapper" @click.stop="toggleSelect($event, item, i)" :checked="shouldSelect" />
          <md-checkbox v-else class="checkbox" touch-target="wrapper" @click.stop="toggleSelect($event, item, i)" :checked="selectedIds.includes(item.id)" />
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
            <md-circular-progress indeterminate class="spinner-sm" v-tooltip="$t('uninstalling')" />
            &nbsp;<md-outlined-button class="btn-sm" @click.stop="cancelUninstall(item)">{{ $t('cancel') }}</md-outlined-button>
          </template>
          <button class="btn-icon sm" v-else @click.stop="uninstall(item)" v-tooltip="$t('uninstall')">
            <md-ripple />
            <i-material-symbols:delete-forever-outline-rounded />
          </button>
          <button class="btn-icon sm" @click.stop="downloadFile(item.path, `${item.name.replace(' ', '')}-${item.id}.apk`)" v-tooltip="$t('download')">
            <md-ripple />
            <i-material-symbols:download-rounded />
          </button>
        </div>
        <div class="time">
          <span v-tooltip="formatDateTimeFull(item.installedAt)">{{ $t('installed_at') }}: {{ formatDateTime(item.installedAt) }} </span>
          <span v-tooltip="formatDateTimeFull(item.updatedAt)">{{ $t('updated_at') }}: {{ formatDateTime(item.updatedAt) }} </span>
        </div>
      </section>
      <template v-if="loading && items.length === 0">
        <section class="app-item selectable-card-skeleton" v-for="i in limit" :key="i">
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
    <div class="no-data-placeholder" v-if="!loading && items.length === 0">
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
import { initMutation, uninstallPackageGQL } from '@/lib/api/mutation'
import { useTempStore, type IUploadItem } from '@/stores/temp'
import { storeToRefs } from 'pinia'
import { useDownload, useDownloadItems } from '@/hooks/files'
import { useFileUpload } from '@/hooks/upload'
import { deleteById } from '@/lib/array'
import emitter from '@/plugins/eventbus'
import { DataType } from '@/lib/data'
import { getFileUrlByPath } from '@/lib/api/file'
import { useSearch } from '@/hooks/search'
import { useKeyEvents } from '@/hooks/key-events'
import { getSortItems } from '@/lib/file'

const { app, urlTokenKey, uploads } = storeToRefs(useTempStore())
const { input: fileInput, upload: uploadFiles, uploadChanged } = useFileUpload(uploads)

const mainStore = useMainStore()
const items = ref<IPackageItem[]>([])
const { t } = useI18n()
const { appSortBy } = storeToRefs(mainStore)
const { parseQ } = useSearch()
const filter = reactive<IFilter>({
  tagIds: [],
})
const sortItems = getSortItems()

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
const { downloadItems } = useDownloadItems(urlTokenKey, DataType.PACKAGE, clearSelection, 'apps.zip')
const { downloadFile } = useDownload(urlTokenKey)
const gotoPage = (page: number) => {
  const q = route.query.q
  replacePath(mainStore, q ? `/apps?page=${page}&q=${q}` : `/apps?page=${page}`)
}
const { keyDown: pageKeyDown, keyUp: pageKeyUp } = useKeyEvents(total, limit, page, selectAll, clearSelection, gotoPage, () => {})

const install = () => {
  uploadFiles(app.value.downloadsDir)
}

const types = ['user', 'system'].map((it) => ({ id: it, name: t('app_type.' + it) }))

const cancelUninstall = (item: IPackageItem) => {
  item.isUninstalling = false
}

const { loading, fetch } = initLazyQuery({
  handle: (data: { packages: IPackage[]; packageCount: number }, error: string) => {
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
  appApi: true,
})

function getUrl(q: string) {
  return q ? `/apps?q=${q}` : `/apps`
}

function sort(slotProps: { close: () => void }, sort: string) {
  appSortBy.value = sort
  slotProps.close()
}

const { mutate: uninstallMutate } = initMutation({
  document: uninstallPackageGQL,
  appApi: true,
})

function uninstall(item: IPackageItem) {
  item.isUninstalling = true
  tapPhone(t('confirm_uninstallation_on_phone'))
  uninstallMutate({ id: item.id })
}

const { loading: fetchPackageStatusLoading, fetch: fetchPackageStatus } = initLazyQuery({
  handle: (data: { packageStatuses: IPackageStatus[] }) => {
    if (data) {
      for (const item of data.packageStatuses) {
        if (!item.exist) {
          deleteById(items.value as any, item.id)
          tapPhone('')
        }
      }
    }
  },
  document: packageStatusesGQL,
  variables: () => ({
    ids: items.value.filter((it) => it.isUninstalling).map((it) => it.id),
  }),
  appApi: true,
})

const uploadTaskDoneHandler = (r: IUploadItem) => {
  if (r.status === 'done') {
    // TODO: install app
  }
}

onActivated(() => {
  setInterval(() => {
    if (items.value.some((it) => it.isUninstalling) && !fetchPackageStatusLoading.value) {
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
  grid-template-columns: 48px 50px 2fr 1fr minmax(140px, auto);
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
    align-items: center;
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
