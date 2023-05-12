<template>
  <div class="v-toolbar">
    <breadcrumb :current="() => `${$t('page_title.apps')} (${total})`" />
    <div class="right-actions">
      <button type="button" class="btn btn-action" @click.stop="downloadItems">{{ $t('download') }}</button>
      <!-- <dropdown :title="$t('actions')" :items="actionItems" /> -->
      <search-input v-model="q" :search="doSearch">
        <template #filters>
          <div class="row mb-3">
            <label class="col-md-3 col-form-label">{{ $t('keywords') }}</label>
            <div class="col-md-9">
              <input type="text" v-model="filter.text" class="form-control" @keyup.enter="applyAndDoSearch" />
            </div>
          </div>
          <div class="actions">
            <button type="button" class="btn" @click.stop="applyAndDoSearch">
              {{ $t('search') }}
            </button>
          </div>
        </template>
      </search-input>
    </div>
  </div>
  <table class="table">
    <thead>
      <tr>
        <th><input class="form-check-input" type="checkbox" @change="toggleSelect" v-model="selectAll" /></th>
        <th>{{ $t('name') }}</th>
        <th>{{ $t('version') }}</th>
        <th>{{ $t('size') }}</th>
        <th>{{ $t('type') }}</th>
        <th>{{ $t('installed_at') }}</th>
        <th>{{ $t('updated_at') }}</th>
        <!-- <th class="actions one">{{ $t('actions') }}</th> -->
      </tr>
    </thead>
    <tbody>
      <tr v-for="item in items" :key="item.id" :class="{ checked: item.checked }"
        @click.stop="item.checked = !item.checked">
        <td><input class="form-check-input" type="checkbox" v-model="item.checked" /></td>
        <td>
          <strong>{{ item.name }} <i-material-symbols:download-rounded class="bi bi-btn"
              @click.stop="downloadFile(item.path, `${item.name.replace(' ', '')}-${item.id}.apk`)" /></strong><br />
          <field-id :id="item.id" :raw="item" />
        </td>
        <td>{{ item.version }}</td>
        <td>{{ formatFileSize(item.size) }}</td>
        <td class="nowrap">{{ $t('app_type.' + item.type) }}</td>
        <td class="nowrap" :title="formatDateTimeFull(item.installedAt)">
          {{ formatDateTime(item.installedAt) }}
        </td>
        <td class="nowrap" :title="formatDateTimeFull(item.updatedAt)">
          {{ formatDateTime(item.updatedAt) }}
        </td>
        <!-- <td class="actions one">
          <a href="#" class="v-link" @click.stop="deleteItem(item)">{{ $t('delete') }}</a>
        </td> -->
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
  <v-pagination v-if="total > limit" v-model="page" :total="total" :limit="limit" />
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import toast from '@/components/toaster'
import { formatDateTime, formatDateTimeFull, formatFileSize } from '@/lib/format'
import { appsGQL, initQuery } from '@/lib/api/query'
import { useRoute } from 'vue-router'
import { replacePath } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import { useI18n } from 'vue-i18n'
import { noDataKey } from '@/lib/list'
import { openModal } from '@/components/modal'
import DeleteConfirm from '@/components/DeleteConfirm.vue'
import { buildQuery, parseQuery, type IFilterField } from '@/lib/search'
import type { IFilter, IDropdownItem } from '@/lib/interfaces'
import { decodeBase64, encodeBase64 } from '@/lib/strutil'
import { useDelete, useSelectable } from './hooks/list'
import { uninstallAppGQL, uninstallAppsGQL } from '@/lib/api/mutation'
import { useTempStore } from '@/stores/temp'
import { storeToRefs } from 'pinia'
import { useDownload, useDownloadItems } from './hooks/files'

const mainStore = useMainStore()
const items = ref<any[]>([])
const { t } = useI18n()
const { app } = storeToRefs(useTempStore())
const filter: IFilter = reactive({
  text: '',
  tags: [],
})

const { downloadItems } = useDownloadItems(items, 'apps.zip')
const { downloadFile } = useDownload(app)
const route = useRoute()
const query = route.query
const page = ref(parseInt(query.page?.toString() ?? '1'))
const limit = 50
const total = ref(0)
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
const { deleteItems } = useDelete(
  uninstallAppsGQL,
  () => {
    refetch()
  },
  items
)
const actionItems: IDropdownItem[] = [
  { text: t('delete'), click: deleteItems },
]

const { selectAll, toggleSelect } = useSelectable(items)
const { loading, refetch } = initQuery({
  handle: (data: any, error: string) => {
    if (error) {
      toast(t(error), 'error')
    } else {
      if (data) {
        items.value = data.apps.map((it: any) => ({ ...it, checked: false }))
        total.value = data.appCount
      }
    }
  },
  document: appsGQL,
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
}

function doSearch() {
  if (currentType) {
    replacePath(mainStore, `/apps/${currentType}?q=${encodeBase64(q.value)}`)
  } else {
    replacePath(mainStore, `/apps?q=${encodeBase64(q.value)}`)
  }
}

function deleteItem(item: any) {
  openModal(DeleteConfirm, {
    id: item.id,
    name: item.id,
    gql: uninstallAppGQL,
    appApi: true,
    typeName: 'Application',
  })
}
</script>