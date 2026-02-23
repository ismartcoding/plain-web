<template>
  <div class="quick-content-main">
    <div class="top-app-bar">
      <button v-tooltip="$t('close')" class="btn-icon" @click="store.quick = ''">
        <i-lucide:x />
      </button>
      <div class="title">{{ $t('bookmarks') }}</div>
      <div class="actions">
        <v-dropdown v-model="sortMenuVisible">
          <template #trigger>
            <v-icon-button v-tooltip="$t('bookmark_sort_order')">
              <i-material-symbols:sort-rounded />
            </v-icon-button>
          </template>
          <div class="dropdown-item" :class="{ selected: bmStore.sortOrder === 'AZ' }" @click="setSortOrder('AZ'); sortMenuVisible = false">
            {{ $t('sort_by.name_asc') }}
          </div>
          <div class="dropdown-item" :class="{ selected: bmStore.sortOrder === 'RECENT_CLICK' }" @click="setSortOrder('RECENT_CLICK'); sortMenuVisible = false">
            {{ $t('bookmark_sort_recent') }}
          </div>
        </v-dropdown>
        <v-dropdown v-model="addMenuVisible">
          <template #trigger>
            <v-icon-button v-tooltip="$t('add_bookmarks')">
              <i-material-symbols:add-rounded />
            </v-icon-button>
          </template>
          <div class="dropdown-item" @click="openAddDialog(''); addMenuVisible = false">
            {{ $t('add_bookmarks') }}
          </div>
          <div class="dropdown-item" @click="openAddGroupDialog(); addMenuVisible = false">
            {{ $t('add_bookmark_group') }}
          </div>
          <div class="dropdown-item" @click="doImport(); addMenuVisible = false">
            {{ $t('import_bookmarks') }}
          </div>
          <div class="dropdown-item" @click="doExport(); addMenuVisible = false">
            {{ $t('export_bookmarks') }}
          </div>
          <div class="dropdown-item danger" @click="clearAllBookmarks(); addMenuVisible = false">
            {{ $t('clear_bookmarks') }}
          </div>
        </v-dropdown>
      </div>
    </div>

    <div class="quick-content-body">
      <!-- Loading -->
      <div v-if="loading" class="loading-state">
        <v-circular-progress indeterminate class="sm" />
      </div>

      <!-- Empty state -->
      <div v-else-if="!bmStore.bookmarks.length && !bmStore.groups.length" class="no-data">
        <div class="empty-content">
          <i-lucide:bookmark class="empty-icon" />
          <div class="empty-text">{{ $t('no_bookmarks') }}</div>
          <button class="btn-primary" @click="openAddDialog('')">
            {{ $t('add_bookmarks') }}
          </button>
        </div>
      </div>

      <div v-else class="bookmark-list">
        <!-- Pinned bookmarks (ungrouped or from any group) -->
        <div v-if="pinnedBookmarks.length" class="bookmark-section pinned-section">
          <div class="section-header">
            <i-lucide:pin class="pin-icon" />
            <span>{{ $t('pinned') }}</span>
          </div>
          <BookmarkItem
            v-for="b in pinnedBookmarks"
            :key="b.id"
            :bookmark="b"
            :groups="bmStore.sortedGroups"
            @click="openBookmark(b)"
            @edit="startEdit(b)"
            @delete="deleteBookmark(b.id)"
            @toggle-pin="togglePin(b)"
          />
        </div>

        <!-- Groups -->
        <div v-for="group in bmStore.sortedGroups" :key="group.id" class="bookmark-section">
          <div class="section-header group-header" @click="toggleGroup(group)">
            <i-lucide:chevron-right
              class="collapse-icon"
              :class="{ expanded: !group.collapsed }"
            />
            <span class="group-name">{{ group.name }}</span>
            <v-dropdown v-model="groupMenus[group.id]" align="top-right-to-bottom-right" @click.stop>
              <template #trigger>
                <button class="btn-icon icon more-trigger">
                  <i-material-symbols:more-vert />
                </button>
              </template>
              <div class="dropdown-item" @click="openAddDialog(group.id); groupMenus[group.id] = false">
                {{ $t('add_bookmarks') }}
              </div>
              <div class="dropdown-item" @click="startEditGroup(group); groupMenus[group.id] = false">
                {{ $t('edit') }}
              </div>
              <div class="dropdown-item danger" @click="clearGroupBookmarks(group.id); groupMenus[group.id] = false">
                {{ $t('clear_group_bookmarks') }}
              </div>
              <div class="dropdown-item danger" @click="deleteGroup(group.id); groupMenus[group.id] = false">
                {{ $t('delete') }}
              </div>
            </v-dropdown>
          </div>
          <transition name="collapse">
            <div v-if="!group.collapsed" class="group-items">
              <BookmarkItem
                v-for="b in nonPinnedBookmarks(group.id)"
                :key="b.id"
                :bookmark="b"
                :groups="bmStore.sortedGroups"
                @click="openBookmark(b)"
                @edit="startEdit(b)"
                @delete="deleteBookmark(b.id)"
                @toggle-pin="togglePin(b)"
              />
              <div v-if="!nonPinnedBookmarks(group.id).length" class="group-empty">
                {{ $t('no_bookmarks_in_group') }}
              </div>
            </div>
          </transition>
        </div>

        <!-- Ungrouped bookmarks (non-pinned) -->
        <div v-if="nonPinnedUngrouped.length" class="bookmark-section">
          <div v-if="bmStore.sortedGroups.length" class="section-header">
            <i-lucide:bookmark />
            <span>{{ $t('ungrouped') }}</span>
          </div>
          <BookmarkItem
            v-for="b in nonPinnedUngrouped"
            :key="b.id"
            :bookmark="b"
            :groups="bmStore.sortedGroups"
            @click="openBookmark(b)"
            @edit="startEdit(b)"
            @delete="deleteBookmark(b.id)"
            @toggle-pin="togglePin(b)"
          />
        </div>
      </div>
    </div>

    <!-- Add bookmarks modal -->
    <AddBookmarksModal
      v-if="addDialogVisible"
      :default-group-id="addDialogGroupId"
      :groups="bmStore.sortedGroups"
      @close="addDialogVisible = false"
      @saved="onBookmarksAdded"
    />

    <!-- Edit bookmark modal -->
    <EditBookmarkModal
      v-if="editBookmark"
      :bookmark="editBookmark"
      :groups="bmStore.sortedGroups"
      @close="editBookmark = null"
      @saved="onBookmarkUpdated"
    />

    <!-- Add/Edit group modal is triggered via openModal in script -->
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMainStore } from '@/stores/main'
import { useBookmarksStore, type Bookmark, type BookmarkGroup } from '@/stores/bookmarks'
import { initLazyQuery, bookmarksGQL } from '@/lib/api/query'
import { initMutation, updateCache, deleteCache } from '@/lib/api/mutation'
import {
  addBookmarksGQL,
  updateBookmarkGQL,
  deleteBookmarksGQL,
  recordBookmarkClickGQL,
  createBookmarkGroupGQL,
  updateBookmarkGroupGQL,
  deleteBookmarkGroupGQL,
} from '@/lib/api/mutation'
import { openModal } from '@/components/modal/methods'
import EditValueModal from './EditValueModal.vue'
import BookmarkItem from './bookmark/BookmarkItem.vue'
import AddBookmarksModal from './AddBookmarksModal.vue'
import EditBookmarkModal from './bookmark/EditBookmarkModal.vue'
import emitter from '@/plugins/eventbus'

const store = useMainStore()
const bmStore = useBookmarksStore()
const { t } = useI18n()

const loading = ref(true)
const sortMenuVisible = ref(false)
const addMenuVisible = ref(false)
const groupMenus = ref<Record<string, boolean>>({})
const addDialogVisible = ref(false)
const addDialogGroupId = ref('')
const editBookmark = ref<Bookmark | null>(null)

// ─── Mutations (initialized at setup level) ────────────────────────────────
const { mutate: mutateRecordClick } = initMutation({ document: recordBookmarkClickGQL })
const { mutate: mutateAddBookmarks } = initMutation({
  document: addBookmarksGQL,
  options: {
    update(cache: any, res: any) {
      if (res.data?.addBookmarks?.length) {
        const q: any = cache.readQuery({ query: bookmarksGQL })
        if (q) {
          cache.writeQuery({
            query: bookmarksGQL,
            data: { ...q, bookmarks: q.bookmarks.concat(res.data.addBookmarks) },
          })
        }
      }
    },
  },
})
const { mutate: mutateUpdateBookmark } = initMutation({
  document: updateBookmarkGQL,
  options: {
    update(cache: any, res: any) {
      if (res.data?.updateBookmark) {
        updateCache(cache, res.data.updateBookmark, bookmarksGQL, 'bookmarks')
      }
    },
  },
})
const { mutate: mutateDeleteBookmarks } = initMutation({
  document: deleteBookmarksGQL,
  options: {
    update(cache: any, _res: any, { variables }: any) {
      if (variables?.ids) {
        deleteCache(cache, variables.ids, bookmarksGQL, 'bookmarks')
      }
    },
  },
})
const { mutate: mutateUpdateGroup } = initMutation({
  document: updateBookmarkGroupGQL,
  options: {
    update(cache: any, res: any) {
      if (res.data?.updateBookmarkGroup) {
        updateCache(cache, res.data.updateBookmarkGroup, bookmarksGQL, 'bookmarkGroups')
      }
    },
  },
})
const { mutate: mutateDeleteGroup } = initMutation({
  document: deleteBookmarkGroupGQL,
  options: {
    update(cache: any, _res: any, { variables }: any) {
      if (variables?.id) {
        deleteCache(cache, variables.id, bookmarksGQL, 'bookmarkGroups')
      }
    },
  },
})

// ─── Query (setup level) ───────────────────────────────────────────────────
const { fetch: fetchBookmarks, refetch: refetchBookmarks } = initLazyQuery({
  handle(data: any, error: string) {
    loading.value = false
    if (!error && data) {
      bmStore.setData(data.bookmarks ?? [], data.bookmarkGroups ?? [])
    }
  },
  document: bookmarksGQL,
})

const pinnedBookmarks = computed(() =>
  bmStore.sortedBookmarks.filter((b) => b.pinned)
)

function nonPinnedBookmarks(groupId: string) {
  return bmStore.bookmarksByGroupId(groupId).filter((b) => !b.pinned)
}

const nonPinnedUngrouped = computed(() =>
  bmStore.ungroupedBookmarks.filter((b) => !b.pinned)
)

// ─── Data loading ──────────────────────────────────────────────────────────
function onWsBookmarkUpdated(items: Bookmark[]) {
  items.forEach((b) => bmStore.updateBookmark({ ...b }))
}

onMounted(() => {
  loading.value = true
  fetchBookmarks()
  emitter.on('bookmark_updated', onWsBookmarkUpdated)
})

onUnmounted(() => {
  emitter.off('bookmark_updated', onWsBookmarkUpdated)
})

function reloadBookmarks() {
  loading.value = true
  refetchBookmarks()
}

// ─── Sort ──────────────────────────────────────────────────────────────────
function setSortOrder(order: 'AZ' | 'RECENT_CLICK') {
  bmStore.sortOrder = order
}

// ─── Open link ─────────────────────────────────────────────────────────────
function openBookmark(b: Bookmark) {
  window.open(b.url, '_blank')
  mutateRecordClick({ id: b.id })
}

// ─── Add ───────────────────────────────────────────────────────────────────
function openAddDialog(groupId: string) {
  addDialogGroupId.value = groupId
  addDialogVisible.value = true
}

function onBookmarksAdded() {
  addDialogVisible.value = false
}

// ─── Edit ──────────────────────────────────────────────────────────────────
function startEdit(b: Bookmark) {
  editBookmark.value = { ...b }
}

function onBookmarkUpdated(updated: Bookmark) {
  editBookmark.value = null
  bmStore.updateBookmark({ ...updated })
}

// ─── Pin ───────────────────────────────────────────────────────────────────
async function togglePin(b: Bookmark) {
  const r = await mutateUpdateBookmark({
    id: b.id,
    input: {
      title: b.title,
      url: b.url,
      groupId: b.groupId,
      pinned: !b.pinned,
      sortOrder: b.sortOrder,
    },
  })
  if (r?.data?.updateBookmark) {
    bmStore.updateBookmark({ ...r.data.updateBookmark })
  }
}

// ─── Delete bookmark ───────────────────────────────────────────────────────
async function deleteBookmark(id: string) {
  const r = await mutateDeleteBookmarks({ ids: [id] })
  if (r?.data) bmStore.deleteBookmarks([id])
}

async function clearAllBookmarks() {
  const ids = bmStore.bookmarks.map((b) => b.id)
  if (!ids.length) return
  const r = await mutateDeleteBookmarks({ ids })
  if (r?.data) bmStore.deleteBookmarks(ids)
}

async function clearGroupBookmarks(groupId: string) {
  const ids = bmStore.bookmarksByGroupId(groupId).map((b) => b.id)
  if (!ids.length) return
  const r = await mutateDeleteBookmarks({ ids })
  if (r?.data) bmStore.deleteBookmarks(ids)
}

// ─── Groups ────────────────────────────────────────────────────────────────
function toggleGroup(group: BookmarkGroup) {
  // Optimistic local update first for instant animation
  bmStore.toggleGroupCollapsed(group.id)
  mutateUpdateGroup({
    id: group.id,
    name: group.name,
    collapsed: group.collapsed,
    sortOrder: group.sortOrder,
  })
}

function startEditGroup(group: BookmarkGroup) {
  openModal(EditValueModal, {
    title: t('edit_group'),
    placeholder: t('name'),
    value: group.name,
    mutation: () =>
      initMutation({
        document: updateBookmarkGroupGQL,
      }),
    getVariables: (value: string) => ({
      id: group.id,
      name: value,
      collapsed: group.collapsed,
      sortOrder: group.sortOrder,
    }),
    done: (value: string) => {
      bmStore.updateGroup({ id: group.id, name: value, collapsed: group.collapsed, sortOrder: group.sortOrder })
    },
  })
}

function openAddGroupDialog() {
  openModal(EditValueModal, {
    title: t('add_bookmark_group'),
    placeholder: t('name'),
    mutation: () =>
      initMutation({
        document: createBookmarkGroupGQL,
      }),
    getVariables: (value: string) => ({ name: value }),
    done: () => {
      reloadBookmarks()
    },
  })
}

async function deleteGroup(id: string) {
  const r = await mutateDeleteGroup({ id })
  if (r?.data) bmStore.deleteGroup(id)
}

// ─── Export (Netscape HTML format) ────────────────────────────────────────
function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function doExport() {
  const lines: string[] = []
  lines.push('<!DOCTYPE NETSCAPE-Bookmark-file-1>')
  lines.push('<!-- This is an automatically generated file. -->')
  lines.push('<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">')
  lines.push('<TITLE>Bookmarks</TITLE>')
  lines.push('<H1>Bookmarks</H1>')
  lines.push('<DL><p>')

  for (const b of bmStore.bookmarks.filter((bm) => !bm.groupId)) {
    const addDate = b.createdAt ? Math.floor(new Date(b.createdAt).getTime() / 1000) : ''
    lines.push(`  <DT><A HREF="${escapeHtml(b.url)}" ADD_DATE="${addDate}">${escapeHtml(b.title || b.url)}</A>`)
  }

  for (const g of bmStore.sortedGroups) {
    lines.push(`  <DT><H3>${escapeHtml(g.name)}</H3>`)
    lines.push('  <DL><p>')
    for (const b of bmStore.bookmarks.filter((bm) => bm.groupId === g.id)) {
      const addDate = b.createdAt ? Math.floor(new Date(b.createdAt).getTime() / 1000) : ''
      lines.push(`    <DT><A HREF="${escapeHtml(b.url)}" ADD_DATE="${addDate}">${escapeHtml(b.title || b.url)}</A>`)
    }
    lines.push('  </DL><p>')
  }

  lines.push('</DL><p>')
  const blob = new Blob([lines.join('\n')], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `bookmarks_${new Date().toISOString().slice(0, 10)}.html`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Import (Netscape HTML format) ────────────────────────────────────────
function doImport() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.html,.htm'
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    const text = await file.text()
    const doc = new DOMParser().parseFromString(text, 'text/html')

    async function walkDL(dl: Element, groupId: string) {
      const urlsBatch: string[] = []
      for (const child of Array.from(dl.children)) {
        if (child.tagName !== 'DT') continue
        const h3 = child.querySelector(':scope > h3')
        const nestedDL = child.querySelector(':scope > dl')
        const a = child.querySelector(':scope > a')

        if (h3 && nestedDL) {
          if (urlsBatch.length) {
            const r = await mutateAddBookmarks({ urls: [...urlsBatch], groupId })
            if (r?.data?.addBookmarks) bmStore.addBookmarks(r.data.addBookmarks.map((b: any) => ({ ...b })))
            urlsBatch.length = 0
          }
          const groupName = h3.textContent?.trim() ?? ''
          const existing = bmStore.groups.find((g) => g.name === groupName)
          await walkDL(nestedDL, existing?.id ?? '')
        } else if (a) {
          const href = (a as HTMLAnchorElement).getAttribute('href') ?? ''
          if (href.startsWith('http://') || href.startsWith('https://')) {
            urlsBatch.push(href)
          }
        }
      }
      if (urlsBatch.length) {
        const r = await mutateAddBookmarks({ urls: urlsBatch, groupId })
        if (r?.data?.addBookmarks) bmStore.addBookmarks(r.data.addBookmarks.map((b: any) => ({ ...b })))
      }
    }

    const rootDL = doc.querySelector('dl')
    if (rootDL) await walkDL(rootDL, '')
  }
  input.click()
}
</script>

<style scoped lang="scss">
.quick-content-body {
  overflow-y: auto;
  height: calc(100vh - 57px);
}

.loading-state {
  display: flex;
  justify-content: center;
  padding: 40px;
}

.no-data {
  display: flex;
  justify-content: center;
  padding: 60px 16px;

  .empty-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    color: var(--md-sys-color-on-surface-variant);

    .empty-icon {
      width: 48px;
      height: 48px;
      opacity: 0.4;
    }

    .empty-text {
      font-size: 1rem;
      opacity: 0.7;
    }

    .btn-primary {
      padding: 8px 20px;
      border-radius: 20px;
      background: var(--md-sys-color-primary);
      color: var(--md-sys-color-on-primary);
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      border: none;
    }
  }
}

.bookmark-list {
  padding-bottom: 16px;
}

.bookmark-section {
  margin-top: 4px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px 4px;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--md-sys-color-on-surface-variant);
  text-transform: uppercase;
  letter-spacing: 0.5px;

  .pin-icon {
    width: 14px;
    height: 14px;
    color: var(--md-sys-color-primary);
  }
}

.group-header {
  cursor: pointer;
  border-radius: 6px;
  padding: 8px 12px;
  user-select: none;
  text-transform: none;
  letter-spacing: 0;
  font-size: 0.875rem;

  &:hover {
    background: var(--md-sys-color-surface-container-high);
  }

  .collapse-icon {
    width: 16px;
    height: 16px;
    transition: transform 0.2s;

    &.expanded {
      transform: rotate(90deg);
    }
  }

  .group-name {
    flex: 1;
  }

  .more-trigger {
    opacity: 0;
    transition: opacity 0.15s;
  }

  &:hover .more-trigger,
  .v-dropdown-container:has(.dropdown-menu.is-open) .more-trigger {
    opacity: 1;
  }
}

.group-items {
  padding-left: 8px;
}

.group-empty {
  padding: 8px 16px;
  font-size: 0.8rem;
  color: var(--md-sys-color-on-surface-variant);
  opacity: 0.6;
  font-style: italic;
}

// ─── Collapse transition ──────────────────────────────────────────────────
.collapse-enter-active,
.collapse-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}

.collapse-enter-from,
.collapse-leave-to {
  max-height: 0;
  opacity: 0;
}

.collapse-enter-to,
.collapse-leave-from {
  max-height: 2000px;
  opacity: 1;
}
</style>
