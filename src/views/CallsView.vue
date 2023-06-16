<template>
  <div class="v-toolbar">
    <breadcrumb :current="() => `${$t('page_title.calls')} (${total})`" />
    <div class="right-actions">
      <template v-if="checked">
        <button type="button" class="btn btn-action" @click.stop="deleteItems" :title="$t('delete')">
          <i-material-symbols:delete-outline-rounded class="bi" />
        </button>
        <button type="button" class="btn btn-action" @click.stop="addToTags" :title="$t('add_to_tags')">
          <i-material-symbols:label-outline-rounded class="bi" />
        </button>
        <button type="button" class="btn btn-action" @click.stop="removeFromTags" :title="$t('remove_from_tags')">
          <i-material-symbols:label-off-outline-rounded class="bi" />
        </button>
      </template>
      <search-input v-model="q" :search="doSearch">
        <template #filters>
          <div class="row mb-3">
            <label class="col-md-3 col-form-label">{{ $t('keywords') }}</label>
            <div class="col-md-9">
              <input type="text" v-model="filter.text" class="form-control" @keyup.enter="applyAndDoSearch" />
            </div>
          </div>
          <div class="row mb-3">
            <label class="col-md-3 col-form-label">{{ $t('tags') }}</label>
            <div class="col-md-9">
              <multiselect v-model="filter.tags" label="name" track-by="id" :options="tags" />
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
        <th>ID</th>
        <th>{{ $t('name') }}</th>
        <th>{{ $t('phone_number') }}</th>
        <th>{{ $t('phone_geo') }}</th>
        <th>{{ $t('duration') }}</th>
        <th>{{ $t('type') }}</th>
        <th>{{ $t('tags') }}</th>
        <th>{{ $t('started_at') }}</th>
        <th class="actions one">{{ $t('actions') }}</th>
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="item in items"
        :key="item.id"
        :class="{ checked: item.checked }"
        @click.stop="item.checked = !item.checked"
      >
        <td><input class="form-check-input" type="checkbox" v-model="item.checked" /></td>
        <td><field-id :id="item.id" :raw="item" /></td>
        <td>
          {{ item.name }}
        </td>
        <td>
          {{ item.number }}
          <i class="spinner spinner-sm" v-if="callLoading && callId === item.id"></i>
          <i-material-symbols:call-outline-rounded class="bi bi-btn" v-else @click.stop="call(item)" />
        </td>
        <td>
          {{ getGeoText(item.geo) }}
        </td>
        <td>
          {{ formatSeconds(item.duration) }}
        </td>
        <td class="nowrap">{{ $t('call_type.' + item.type) }}</td>
        <td>
          <span v-for="tag in item.tags" class="badge">{{ tag.name }}</span>
        </td>
        <td class="nowrap" :title="formatDateTimeFull(item.startedAt)">
          {{ formatDateTime(item.startedAt) }}
        </td>
        <td class="actions one">
          <a href="#" class="v-link" @click.stop="deleteItem(item)">{{ $t('delete') }}</a>
        </td>
      </tr>
    </tbody>
    <tfoot v-if="!items.length">
      <tr>
        <td colspan="10">
          <div class="no-data-placeholder">
            {{ $t(noDataKey(loading, app.permissions, 'READ_CALL_LOG')) }}
          </div>
        </td>
      </tr>
    </tfoot>
  </table>
  <v-pagination v-if="total > limit" v-model="page" :total="total" :limit="limit" />
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import toast from '@/components/toaster'
import { formatDateTime, formatDateTimeFull, formatSeconds } from '@/lib/format'
import { callsGQL, initLazyQuery } from '@/lib/api/query'
import { useRoute } from 'vue-router'
import { replacePath } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import { useTempStore } from '@/stores/temp'
import gql from 'graphql-tag'
import { useI18n } from 'vue-i18n'
import { noDataKey } from '@/lib/list'
import { storeToRefs } from 'pinia'
import { openModal } from '@/components/modal'
import DeleteConfirm from '@/components/DeleteConfirm.vue'
import { buildQuery, type IFilterField } from '@/lib/search'
import type { IFilter } from '@/lib/interfaces'
import { decodeBase64, encodeBase64 } from '@/lib/strutil'
import { kebabCase } from 'lodash'
import { useDelete, useSelectable } from './hooks/list'
import { useAddToTags, useRemoveFromTags, useTags } from './hooks/tags'
import emitter from '@/plugins/eventbus'
import { callGQL, deleteCallsGQL, initMutation } from '@/lib/api/mutation'

const mainStore = useMainStore()
const { app } = storeToRefs(useTempStore())
const items = ref<any[]>([])
const { t } = useI18n()
const filter: IFilter = reactive({
  text: '',
  tags: [],
})

const tagType = 'CALL'
const route = useRoute()
const query = route.query
const page = ref(parseInt(query.page?.toString() ?? '1'))
const limit = 50
const total = ref(0)
const q = ref(decodeBase64(query.q?.toString() ?? ''))
const finalQ = ref('')
const { tags } = useTags(tagType, q, filter, async (fields: IFilterField[]) => {
  if (currentType) {
    fields.push({
      name: 'type',
      op: '',
      value: types[currentType].toString(),
    })
  }

  finalQ.value = buildQuery(fields)
  await nextTick()
  load()
})
const { addToTags } = useAddToTags(tagType, items, tags)
const { removeFromTags } = useRemoveFromTags(tagType, items, tags)
const { deleteItems } = useDelete(
  deleteCallsGQL,
  () => {
    refetch()
  },
  items
)
const checked = computed<boolean>(() => {
  return items.value.some((it) => it.checked)
})

const { selectAll, toggleSelect } = useSelectable(items)
const { loading, load, refetch } = initLazyQuery({
  handle: (data: any, error: string) => {
    if (error) {
      toast(t(error), 'error')
    } else {
      if (data) {
        items.value = data.calls.map((it: any) => ({ ...it, checked: false }))
        total.value = data.callCount
      }
    }
  },
  document: callsGQL,
  variables: () => ({
    offset: (page.value - 1) * limit,
    limit,
    query: finalQ.value,
  }),
  appApi: true,
})

const currentType = route.params['type'] as string
const types: Record<string, number> = {
  incoming: 1,
  outgoing: 2,
  missed: 3,
}

watch(page, (value: number) => {
  if (currentType) {
    replacePath(mainStore, `/calls/${currentType}?page=${value}&q=${encodeBase64(q.value)}`)
  } else {
    replacePath(mainStore, `/calls?page=${value}&q=${encodeBase64(q.value)}`)
  }
})

function applyAndDoSearch() {
  const fileds: IFilterField[] = []
  for (const tag of filter.tags) {
    fileds.push({
      name: 'tag',
      op: '',
      value: kebabCase(tag.name),
    })
  }

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
    replacePath(mainStore, `/calls/${currentType}?q=${encodeBase64(q.value)}`)
  } else {
    replacePath(mainStore, `/calls?q=${encodeBase64(q.value)}`)
  }
}

onMounted(() => {
  emitter.on('refetch_by_tag_type', (type: string) => {
    if (type === tagType) {
      refetch()
    }
  })
})

function getGeoText(geo: any) {
  if (!geo) {
    return ''
  }

  const texts = []
  if (geo.isp) {
    texts.push(t('phone_isp_type.' + geo.isp))
  }

  if (geo.city === geo.province) {
    texts.push(geo.city)
  } else {
    texts.push(`${geo.province}${geo.city}`)
  }

  return texts.join(', ')
}

const callId = ref('')
const { mutate: mutateCall, loading: callLoading } = initMutation({
  document: callGQL,
  appApi: true,
})

function call(item: any) {
  callId.value = item.id
  mutateCall({ number: item.number })
}

function deleteItem(item: any) {
  openModal(DeleteConfirm, {
    id: item.id,
    name: item.id,
    gql: gql`
      mutation DeleteCall($id: ID!) {
        deleteCalls(ids: [$id])
      }
    `,
    appApi: true,
    typeName: 'Call',
  })
}
</script>
