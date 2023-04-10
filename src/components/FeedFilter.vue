<template>
  <h2 class="nav-title mt-4">
    {{ $t('subscriptions') }}
    <dropdown class="dropdown-sm" :title="$t('add')" :items="actionItems" />
  </h2>
  <ul class="nav">
    <li
      v-for="item in feeds"
      @click.prevent="view(item)"
      @contextmenu="itemCtxMenu($event, item)"
      :class="{ active: route.params.feedId === item.id || (selected && kebabCase(item.name) === selected) }"
    >
      {{ item.name }}
    </li>
  </ul>
  <input ref="fileInput" style="display: none" accept=".xml" type="file" @change="uploadChanged" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { initQuery, feedsGQL } from '@/lib/api/query'
import { replacePath } from '@/plugins/router'
import type { IDropdownItem, IFeed } from '@/lib/interfaces'
import { useMainStore } from '@/stores/main'
import { encodeBase64 } from '@/lib/strutil'
import { buildQuery } from '@/lib/search'
import { kebabCase } from 'lodash-es'
import toast from '@/components/toaster'
import { useI18n } from 'vue-i18n'
import { openModal } from './modal'
import EditValueModal from '@/components/EditValueModal.vue'
import { createFeedGQL, deleteFeedGQL, exportFeedsGQL, importFeedsGQL, initMutation } from '@/lib/api/mutation'
import { downloadFromString } from '@/lib/api/file'
import { contextmenu } from './contextmenu'
import DeleteConfirm from '@/components/DeleteConfirm.vue'
import FeedModal from './FeedModal.vue'
import { useRoute } from 'vue-router'

const { t } = useI18n()

const mainStore = useMainStore()
const feeds = ref<IFeed[]>([])
const fileInput = ref<HTMLInputElement>()
const route = useRoute()
const actionItems: IDropdownItem[] = [
  { text: t('add_subscription'), click: add },
  { text: t('import_opml_file'), click: importFile },
  { text: t('export_opml_file'), click: exportFile },
]

defineProps({
  selected: { type: String, required: true },
})

const { refetch } = initQuery({
  handle: (data: any, error: string) => {
    if (error) {
      toast(t(error), 'error')
    } else {
      if (data) {
        feeds.value = data.feeds
      }
    }
  },
  document: feedsGQL,
  appApi: true,
})

function uploadChanged(e: Event) {
  const files = (e.target as HTMLInputElement).files
  if (!files) {
    return
  }
  const reader = new FileReader()
  reader.addEventListener(
    'load',
    () => {
      importOPML({ content: reader.result })
    },
    false
  )
  reader.readAsText(files[0])
}

function add() {
  openModal(EditValueModal, {
    title: t('add_subscription'),
    placeholder: t('rss_url'),
    mutation: () => {
      return initMutation({
        document: createFeedGQL,
        options: {
          update: () => {
            refetch()
          },
        },
        appApi: true,
      })
    },
    getVariables: (value: string) => {
      return { url: value }
    },
  })
}

const { mutate: exportOPML, onDone: onExpored } = initMutation({
  document: exportFeedsGQL,
  appApi: true,
})

onExpored((r: any) => {
  downloadFromString(r.data.exportFeeds, 'application/xml', 'feeds.xml')
})

const { mutate: importOPML, onDone: onImported } = initMutation({
  document: importFeedsGQL,
  appApi: true,
})

onImported(() => {
  toast(t('imported'))
  refetch()
})

function importFile() {
  fileInput.value!.value = ''
  fileInput.value!.click()
}

function exportFile() {
  exportOPML()
}

function view(item: IFeed) {
  const q = buildQuery([
    {
      name: 'feed',
      op: '',
      value: kebabCase(item.name),
    },
  ])
  replacePath(mainStore, `/feeds?q=${encodeBase64(q)}`)
}

function itemCtxMenu(e: MouseEvent, item: IFeed) {
  e.preventDefault()
  contextmenu({
    x: e.x,
    y: e.y,
    items: [
      {
        label: t('edit'),
        onClick: () => {
          openModal(FeedModal, {
            data: item,
          })
        },
      },
      {
        label: t('delete'),
        onClick: () => {
          openModal(DeleteConfirm, {
            id: item.id,
            name: item.name,
            gql: deleteFeedGQL,
            appApi: true,
            typeName: 'Feed',
            done: () => {
              replacePath(mainStore, `/feeds`)
            },
          })
        },
      },
    ],
  })
}
</script>
