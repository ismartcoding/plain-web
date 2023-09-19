<template>
  <div class="page-container">
    <splitpanes>
      <pane size="20" min-size="10">
        <div class="sidebar">
          <h2 class="nav-title">
            {{ $t('page_title.feeds') }}
            <div style="position: relative">
              <md-menu
                anchor="add-feed-ref"
                menu-corner="START_START"
                anchor-corner="END_END"
                fixed="true"
                stay-open-on-focusout
                quick
                :open="addMenuVisible"
                @closed="() => (addMenuVisible = false)"
              >
                <md-menu-item v-for="item in actionItems" :headline="item.text" @click="item.click" />
              </md-menu>
              <button
                class="icon-button"
                id="add-feed-ref"
                @click="() => (addMenuVisible = true)"
                v-tooltip="t('add_subscription')"
              >
                <md-ripple />
                <i-material-symbols:add-rounded />
              </button>
            </div>
          </h2>
          <ul class="nav">
            <li
              @click.prevent="all"
              :class="{ active: route.path === '/feeds' && !selectedTagName && !selectedFeedName }"
            >
              {{ $t('all') }}
            </li>
            <li
              v-for="item in feeds"
              @click.prevent="view(item)"
              @contextmenu="itemCtxMenu($event, item)"
              :class="{
                active:
                  route.params.feedId === item.id || (selectedFeedName && kebabCase(item.name) === selectedFeedName),
              }"
            >
              {{ item.name }}
            </li>
          </ul>
          <tag-filter type="FEED_ENTRY" :selected="selectedTagName" />
        </div>
      </pane>
      <pane>
        <div class="main">
          <router-view />
        </div>
      </pane>
    </splitpanes>
    <input ref="fileInput" style="display: none" accept=".xml" type="file" @change="uploadChanged" />
  </div>
</template>

<script lang="ts">
export default {
  name: 'FeedsRoot',
  inheritAttrs: false,
  customOptions: {},
}
</script>

<script setup lang="ts">
import { Splitpanes, Pane } from 'splitpanes'
import { useRoute } from 'vue-router'
import { replacePath } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import { buildQuery, parseFeedName, parseTagName } from '@/lib/search'
import type { IDropdownItem, IFeed } from '@/lib/interfaces'
import { ref } from 'vue'
import EditValueModal from '@/components/EditValueModal.vue'
import { createFeedGQL, deleteFeedGQL, exportFeedsGQL, importFeedsGQL, initMutation } from '@/lib/api/mutation'
import { downloadFromString } from '@/lib/api/file'
import { useI18n } from 'vue-i18n'
import toast from '@/components/toaster'
import { contextmenu } from '@/components/contextmenu'
import { openModal } from '@/components/modal'
import { initQuery, feedsGQL } from '@/lib/api/query'
import { encodeBase64 } from '@/lib/strutil'
import { kebabCase } from 'lodash-es'
import DeleteConfirm from '@/components/DeleteConfirm.vue'
import FeedModal from '@/components/FeedModal.vue'

const { t } = useI18n()
const mainStore = useMainStore()
const feeds = ref<IFeed[]>([])
const actionItems: IDropdownItem[] = [
  { text: t('add_subscription'), click: add },
  { text: t('import_opml_file'), click: importFile },
  { text: t('export_opml_file'), click: exportFile },
]
const addMenuVisible = ref(false)
const route = useRoute()
const selectedTagName = parseTagName(route.query)
const selectedFeedName = parseFeedName(route.query)
const fileInput = ref<HTMLInputElement>()

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

function all() {
  replacePath(mainStore, '/feeds')
}
</script>
