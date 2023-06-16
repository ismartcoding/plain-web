<template>
  <div class="v-toolbar">
    <breadcrumb :current="() => `${$t('page_title.messages')} (${total})`" />
    <div class="right-actions">
      <template v-if="checked">
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
        <th>{{ $t('content') }}</th>
        <th>{{ $t('sms_address') }}</th>
        <th>{{ $t('type') }}</th>
        <th>{{ $t('tags') }}</th>
        <th>{{ $t('time') }}</th>
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
        <td>
          <field-id :id="item.id" :raw="item" />
        </td>
        <td>{{ item.body }}</td>
        <td>{{ item.address }}</td>
        <td class="nowrap">{{ $t(`message_type.${item.type}`) }}</td>
        <td>
          <span v-for="tag in item.tags" class="badge">{{ tag.name }}</span>
        </td>
        <td :title="formatDateTimeFull(item.date)" class="nowrap">
          {{ formatDateTime(item.date) }}
        </td>
      </tr>
    </tbody>
    <tfoot v-if="!items.length">
      <tr>
        <td colspan="7">
          <div class="no-data-placeholder">
            {{ $t(noDataKey(loading, app.permissions, 'READ_SMS')) }}
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
import { formatDateTime, formatDateTimeFull } from '@/lib/format'
import { initLazyQuery, messagesGQL } from '@/lib/api/query'
import { useRoute } from 'vue-router'
import { replacePath } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import { useTempStore } from '@/stores/temp'
import { useI18n } from 'vue-i18n'
import { noDataKey } from '@/lib/list'
import { storeToRefs } from 'pinia'
import type { IFilter, IMessage, IMessageItem } from '@/lib/interfaces'
import { useAddToTags, useRemoveFromTags, useTags } from './hooks/tags'
import { decodeBase64, encodeBase64 } from '@/lib/strutil'
import { useSelectable } from './hooks/list'
import emitter from '@/plugins/eventbus'
import { buildFilterQuery, buildQuery, type IFilterField } from '@/lib/search'

const mainStore = useMainStore()
const { app } = storeToRefs(useTempStore())
const items = ref<IMessageItem[]>([])
const { t } = useI18n()
const filter: IFilter = reactive({
  text: '',
  tags: [],
})

const tagType = 'SMS'
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
        items.value = data.messages.map((it: IMessage) => ({ ...it, checked: false }))
        total.value = data.messageCount
      }
    }
  },
  document: messagesGQL,
  variables: () => ({
    offset: (page.value - 1) * limit,
    limit,
    query: finalQ.value,
  }),
  appApi: true,
})

const currentType = route.params['type'] as string
const types: Record<string, number> = {
  inbox: 1,
  sent: 2,
  drafts: 3,
  outbox: 4,
}

watch(page, (value: number) => {
  if (currentType) {
    replacePath(mainStore, `/messages/${currentType}?page=${value}&q=${encodeBase64(q.value)}`)
  } else {
    replacePath(mainStore, `/messages?page=${value}&q=${encodeBase64(q.value)}`)
  }
})

function applyAndDoSearch() {
  q.value = buildFilterQuery(filter)
  doSearch()
}

function doSearch() {
  if (currentType) {
    replacePath(mainStore, `/messages/${currentType}?q=${encodeBase64(q.value)}`)
  } else {
    replacePath(mainStore, `/messages?q=${encodeBase64(q.value)}`)
  }
}

onMounted(() => {
  emitter.on('refetch_by_tag_type', (type: string) => {
    if (type === tagType) {
      refetch()
    }
  })
})
</script>
