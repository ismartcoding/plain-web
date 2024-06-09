<template>
  <div class="top-app-bar">
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
    <div class="table-responsive">
      <table class="table">
        <thead>
          <tr>
            <th>
              <md-checkbox touch-target="wrapper" @change="toggleAllChecked" :checked="allChecked" :indeterminate="!allChecked && checked" />
            </th>
            <th></th>
            <th>{{ $t('name') }}</th>
            <th></th>
            <th>{{ $t('size') }}</th>
            <th>{{ $t('type') }}</th>
            <th>{{ $t('installed_at') }}</th>
            <th>{{ $t('updated_at') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, i) in items" :key="item.id" :class="{ selected: selectedIds.includes(item.id) }" @click.stop="toggleRow($event, item, i)">
            <td><md-checkbox touch-target="wrapper" @change="toggleRow($event, item, i)" :checked="selectedIds.includes(item.id)" /></td>
            <td>
              <div class="v-center">
                <img width="50" height="50" :src="item.icon" />
              </div>
            </td>
            <td>
              <strong class="v-center">{{ item.name }} ({{ item.version }})</strong>
              <field-id :id="item.id" :raw="item" />
            </td>
            <td class="nowrap">
              <div class="action-btns">
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
            </td>
            <td class="nowrap">{{ formatFileSize(item.size) }}</td>
            <td class="nowrap">{{ $t('app_type.' + item.type) }}</td>
            <td class="nowrap">
              <time v-tooltip="formatDateTimeFull(item.installedAt)">
                {{ formatDateTime(item.installedAt) }}
              </time>
            </td>
            <td class="nowrap">
              <time v-tooltip="formatDateTimeFull(item.updatedAt)">{{ formatDateTime(item.updatedAt) }}</time>
            </td>
          </tr>
        </tbody>
        <tfoot v-if="!items.length">
          <tr>
            <td colspan="8">
              <div class="no-data-placeholder">
                {{ $t(noDataKey(loading)) }}
              </div>
            </td>
          </tr>
        </tfoot>
      </table>
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
import { useDownload, useDownloadItems, useFileUpload } from '@/hooks/files'
import { deleteById } from '@/lib/array'
import emitter from '@/plugins/eventbus'
import { DataType } from '@/lib/data'
import { getFileUrlByPath } from '@/lib/api/file'
import { useSearch } from '@/hooks/search'
import { useKeyEvents } from '@/hooks/key-events'

const { input: fileInput, upload: uploadFiles, uploadChanged } = useFileUpload()

const mainStore = useMainStore()
const items = ref<IPackageItem[]>([])
const { t } = useI18n()
const { app, urlTokenKey } = storeToRefs(useTempStore())
const { parseQ } = useSearch()
const filter = reactive<IFilter>({
  tagIds: [],
})

const route = useRoute()
const query = route.query
const page = ref(parseInt(query.page?.toString() ?? '1'))
const limit = 50
const q = ref('')

const { selectedIds, allChecked, realAllChecked, selectRealAll, allCheckedAlertVisible, clearSelection, toggleAllChecked, toggleRow, total, checked, selectAll } = useSelectable(items)
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
  }),
  appApi: true,
})

function getUrl(q: string) {
  return q ? `/apps?q=${q}` : `/apps`
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
