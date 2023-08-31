<template>
  <div class="v-toolbar">
    <breadcrumb :current="() => `${$t('page_title.apps')} (${total})`" />
    <template v-if="checked">
      <button class="icon-button" @click.stop="downloadItems(realAllChecked, finalQ)" v-tooltip="$t('download')">
        <md-ripple />
        <i-material-symbols:download-rounded />
      </button>
    </template>
    <button class="icon-button" @click.stop="install" style="display: none">
      <md-ripple />
      {{ $t('install') }}
    </button>
    <search-input ref="searchInputRef" v-model="q" :search="doSearch">
      <template #filters>
        <div class="filters">
          <div class="form-row">
            <md-outlined-text-field :label="$t('keywords')" v-model="filter.text" keyup.enter="applyAndDoSearch" />
          </div>
          <div class="buttons">
            <md-filled-button @click.stop="applyAndDoSearch">
              {{ $t('search') }}
            </md-filled-button>
          </div>
        </div>
      </template>
    </search-input>
  </div>
  <all-checked-alert
    :limit="limit"
    :total="total"
    :all-checked-alert-visible="allCheckedAlertVisible"
    :real-all-checked="realAllChecked"
    :select-real-all="selectRealAll"
    :clear-selection="clearSelection"
  />
  <div class="table-responsive">
    <table class="table">
      <thead>
        <tr>
          <th>
            <md-checkbox
              touch-target="wrapper"
              @change="toggleAllChecked"
              :checked="allChecked"
              :indeterminate="!allChecked && checked"
            />
          </th>
          <th>{{ $t('name') }}</th>
          <th></th>
          <th>{{ $t('size') }}</th>
          <th>{{ $t('type') }}</th>
          <th>{{ $t('installed_at') }}</th>
          <th>{{ $t('updated_at') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="item in items"
          :key="item.id"
          :class="{ selected: item.checked }"
          @click.stop="item.checked = !item.checked"
        >
          <td><md-checkbox touch-target="wrapper" @change="toggleItemChecked" :checked="item.checked" /></td>
          <td>
            <strong class="v-center">{{ item.name }} ({{ item.version }})</strong>
            <field-id :id="item.id" :raw="item" />
          </td>
          <td class="nowrap">
            <div class="action-btns">
              <md-circular-progress
                indeterminate
                class="spinner-sm"
                v-if="item.isUninstalling"
                v-tooltip="$t('uninstalling')"
              />
              <button class="icon-button" v-else @click.stop="uninstall(item)" v-tooltip="$t('uninstall')">
                <md-ripple />
                <i-material-symbols:delete-forever-outline-rounded />
              </button>
              <button
                class="icon-button"
                @click.stop="downloadFile(item.path, `${item.name.replace(' ', '')}-${item.id}.apk`)"
                v-tooltip="$t('download')"
              >
                <md-ripple />
                <i-material-symbols:download-rounded />
              </button>
            </div>
          </td>
          <td class="nowrap">{{ formatFileSize(item.size) }}</td>
          <td class="nowrap">{{ $t('app_type.' + item.type) }}</td>
          <td class="nowrap">
            <span v-tooltip="formatDateTimeFull(item.installedAt)">
              {{ formatDateTime(item.installedAt) }}
            </span>
          </td>
          <td class="nowrap">
            <span v-tooltip="formatDateTimeFull(item.updatedAt)">{{ formatDateTime(item.updatedAt) }}</span>
          </td>
        </tr>
      </tbody>
      <tfoot v-if="!items.length">
        <tr>
          <td colspan="7">
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
import { formatDateTime, formatDateTimeFull, formatFileSize } from '@/lib/format'
import { packagesGQL, initQuery, initLazyQuery, packageStatusesGQL } from '@/lib/api/query'
import { useRoute } from 'vue-router'
import { replacePath } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import { useI18n } from 'vue-i18n'
import { noDataKey } from '@/lib/list'
import { buildQuery, parseQuery, type IFilterField } from '@/lib/search'
import type { IFilter, IAppItem, IApp } from '@/lib/interfaces'
import { decodeBase64, encodeBase64 } from '@/lib/strutil'
import { useSelectable } from './hooks/list'
import { initMutation, uninstallPackageGQL } from '@/lib/api/mutation'
import { useTempStore, type IUploadItem } from '@/stores/temp'
import { storeToRefs } from 'pinia'
import { useDownload, useDownloadItems, useFileUpload } from './hooks/files'
import { deleteById } from '@/lib/array'
import emitter from '@/plugins/eventbus'
import { DataType } from '@/lib/data'

const { input: fileInput, upload: uploadFiles, uploadChanged } = useFileUpload()

const mainStore = useMainStore()
const items = ref<IAppItem[]>([])
const searchInputRef = ref()
const { t } = useI18n()
const { app, urlTokenKey } = storeToRefs(useTempStore())
const filter: IFilter = reactive({
  text: '',
  tags: [],
})

const {
  allChecked,
  realAllChecked,
  selectRealAll,
  allCheckedAlertVisible,
  clearSelection,
  toggleAllChecked,
  toggleItemChecked,
  total,
  checked,
} = useSelectable(items)
const { downloadItems } = useDownloadItems(urlTokenKey, DataType.PACKAGE, items, clearSelection, 'apps.zip')
const { downloadFile } = useDownload(urlTokenKey)
const route = useRoute()
const query = route.query
const page = ref(parseInt(query.page?.toString() ?? '1'))
const limit = 50
const q = ref(decodeBase64(query.q?.toString() ?? ''))
const fields = parseQuery(q.value as string)
const currentType = route.params['type'] as string
if (currentType) {
  fields.push({
    name: 'type',
    op: '',
    value: currentType,
  })
}

const finalQ = ref(buildQuery(fields))

const install = () => {
  uploadFiles(app.value.downloadsDir)
}

const { loading } = initQuery({
  handle: (data: any, error: string) => {
    if (error) {
      toast(t(error), 'error')
    } else {
      if (data) {
        items.value = data.packages.map((it: IApp) => ({ ...it, checked: false }))
        total.value = data.packageCount
      }
    }
  },
  document: packagesGQL,
  variables: () => ({
    offset: (page.value - 1) * limit,
    limit,
    query: finalQ.value,
  }),
  appApi: true,
})

watch(page, (value: number) => {
  if (currentType) {
    replacePath(mainStore, `/apps/${currentType}?page=${value}&q=${encodeBase64(q.value)}`)
  } else {
    replacePath(mainStore, `/apps?page=${value}&q=${encodeBase64(q.value)}`)
  }
})

function applyAndDoSearch() {
  const fileds: IFilterField[] = []
  if (filter.text) {
    fileds.push({
      name: 'text',
      op: '',
      value: filter.text,
    })
  }

  q.value = buildQuery(fileds)
  doSearch()
  searchInputRef.value.dismiss()
}

function doSearch() {
  if (currentType) {
    replacePath(mainStore, `/apps/${currentType}?q=${encodeBase64(q.value)}`)
  } else {
    replacePath(mainStore, `/apps?q=${encodeBase64(q.value)}`)
  }
}

const { mutate: uninstallMutate, onDone: uninstallDone } = initMutation({
  document: uninstallPackageGQL,
  appApi: true,
})

function uninstall(item: any) {
  uninstallDone(() => {
    item.isUninstalling = true
  })
  uninstallMutate({ id: item.id })
}

const {
  loading: fetchPackageStatusLoading,
  load: fetchPackageStatus,
  refetch: refetchPackageStatus,
} = initLazyQuery({
  handle: (data: any, _error: string) => {
    if (data) {
      for (const item of data.packageStatuses) {
        if (!item.exist) {
          deleteById(items.value as any, item.id)
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
  emitter.on('upload_task_done', uploadTaskDoneHandler)

  let firstLoad = true
  setInterval(() => {
    if (items.value.some((it) => it.isUninstalling) && !fetchPackageStatusLoading.value) {
      if (firstLoad) {
        fetchPackageStatus()
        firstLoad = false
      } else {
        refetchPackageStatus()
      }
    }
  }, 1000)
})

onDeactivated(() => {
  emitter.off('upload_task_done', uploadTaskDoneHandler)
})
</script>
