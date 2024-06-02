<template>
  <div class="top-app-bar">
    <div class="title">{{ $t('page_title.apps') }} ({{ total.toLocaleString() }})</div>
    <div class="actions">
      <search-input :filter="filter" :types="types" :get-url="getUrl" />
      <template v-if="checked">
        <button class="btn-icon" @click.stop="downloadItems(realAllChecked, q)" v-tooltip="$t('download')">
          <md-ripple />
          <i-material-symbols:download-rounded />
        </button>
      </template>
      <button class="btn-icon" @click.stop="install" style="display: none">
        <md-ripple />
        {{ $t('install') }}
      </button>
    </div>
  </div>
  <all-checked-alert :limit="limit" :total="total" :all-checked-alert-visible="allCheckedAlertVisible" :real-all-checked="realAllChecked" :select-real-all="selectRealAll" :clear-selection="clearSelection" />
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
        <tr v-for="item in items" :key="item.id" :class="{ selected: item.checked }" @click.stop="toggleRow(item)">
          <td><md-checkbox touch-target="wrapper" @change="toggleItemChecked" :checked="item.checked" /></td>
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
  <v-pagination v-if="total > limit" v-model="page" :total="total" :limit="limit" />
  <input ref="fileInput" style="display: none" type="file" accept=".apk" multiple @change="uploadChanged" />
</template>

<script setup lang="ts">
import { onActivated, onDeactivated, reactive, ref, watch } from 'vue'
import toast from '@/components/toaster'
import tapPhone from '@/plugins/tapphone'
import { formatDateTime, formatDateTimeFull, formatFileSize } from '@/lib/format'
import { packagesGQL, initLazyQuery, packageStatusesGQL } from '@/lib/api/query'
import { useRoute } from 'vue-router'
import { replacePath } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import { useI18n } from 'vue-i18n'
import { noDataKey } from '@/lib/list'
import type { IFilter, IAppItem, IApp } from '@/lib/interfaces'
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

const { input: fileInput, upload: uploadFiles, uploadChanged } = useFileUpload()

const mainStore = useMainStore()
const items = ref<IAppItem[]>([])
const { t } = useI18n()
const { app, urlTokenKey } = storeToRefs(useTempStore())
const { parseQ } = useSearch()
const filter = reactive<IFilter>({
  tagIds: [],
})
const { allChecked, realAllChecked, selectRealAll, allCheckedAlertVisible, clearSelection, toggleAllChecked, toggleItemChecked, toggleRow, total, checked } = useSelectable(items)
const { downloadItems } = useDownloadItems(urlTokenKey, DataType.PACKAGE, items, clearSelection, 'apps.zip')
const { downloadFile } = useDownload(urlTokenKey)
const route = useRoute()
const query = route.query
const page = ref(parseInt(query.page?.toString() ?? '1'))
const limit = 50
const q = ref('')

const install = () => {
  uploadFiles(app.value.downloadsDir)
}

const types = ['user', 'system'].map((it) => ({ id: it, name: t('app_type.' + it) }))

const cancelUninstall = (item: any) => {
  item.isUninstalling = false
}

const { loading, fetch } = initLazyQuery({
  handle: (data: any, error: string) => {
    if (error) {
      toast(t(error), 'error')
    } else {
      if (data) {
        items.value = data.packages.map((it: IApp) => ({
          ...it,
          checked: false,
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

watch(page, (value: number) => {
  const q = route.query.q
  replacePath(mainStore, q ? `/apps?page=${value}&q=${q}` : `/apps?page=${value}`)
})

function getUrl(q: string) {
  return q ? `/apps?q=${q}` : `/apps`
}

const { mutate: uninstallMutate } = initMutation({
  document: uninstallPackageGQL,
  appApi: true,
})

function uninstall(item: any) {
  item.isUninstalling = true
  tapPhone(t('confirm_uninstallation_on_phone'))
  uninstallMutate({ id: item.id })
}

const { loading: fetchPackageStatusLoading, fetch: fetchPackageStatus } = initLazyQuery({
  handle: (data: any, _error: string) => {
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
})

onDeactivated(() => {
  emitter.off('upload_task_done', uploadTaskDoneHandler)
})
</script>
