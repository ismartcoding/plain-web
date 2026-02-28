<template>
  <template v-if="placement === 'top'">
    <v-dropdown v-if="uiMode === 'edit' && !filterTrash && (!isPhone || !checked)" v-model="uploadMenu">
      <template #trigger>
        <v-icon-button v-tooltip="$t('upload')">
          <i-material-symbols:upload-rounded />
        </v-icon-button>
      </template>
      <div class="dropdown-item" @click.stop="onUploadFiles(); uploadMenu = false">
        {{ $t('upload_files') }}
      </div>
      <div class="dropdown-item" @click.stop="onUploadDir(); uploadMenu = false">
        {{ $t('upload_folder') }}
      </div>
    </v-dropdown>

    <UIModeToggleButton
      v-if="!filterTrash"
      :mode="uiMode"
      :tooltip="uiMode === 'edit' ? $t('view') : $t('edit')"
      @click="onToggleUiMode"
    />

    <v-dropdown v-if="!checked && !hideMoreMenu && !showViewOptions" v-model="moreMenu">
      <template #trigger>
        <v-icon-button v-tooltip="$t('sort')">
          <i-material-symbols:sort-rounded />
        </v-icon-button>
      </template>

      <div class="dropdown-item" @click.stop="onOpenKeyboardShortcuts(); moreMenu = false">
        {{ $t('keyboard_shortcuts') }}
      </div>

      <div
        v-for="item in sortItems"
        :key="item.value"
        class="dropdown-item"
        :class="{ 'selected': item.value === sortBy }"
        @click.stop="onSort(item.value); moreMenu = false"
      >
        {{ $t(item.label) }}
      </div>
    </v-dropdown>



    <ViewToggleButtons
      v-if="showViewToggle && !isPhone && !hideViewToggle"
      :card-view="safeCardView"
      @update:card-view="(value: boolean) => onUpdateCardView(value)"
    />

    <ViewOptionsPanel
      v-if="!checked && showViewOptions"
      :show-group-by="showGroupBy"
      :group-by-items="groupByItems"
      :group-by="groupBy"
      :scroll-paging="scrollPaging ?? false"
      :sort-by="sortBy"
      :sort-items="sortItems"
      :on-open-keyboard-shortcuts="onOpenKeyboardShortcuts"
      @update:groupBy="emit('update:groupBy', $event)"
      @update:scrollPaging="emit('update:scrollPaging', $event)"
      @update:sortBy="onSort($event)"
    />
  </template>

  <template v-else>
    <template v-if="filterTrash">
      <v-dropdown v-model="moreMenu">
        <template #trigger>
          <v-icon-button v-tooltip="$t('sort')">
            <i-material-symbols:sort-rounded />
          </v-icon-button>
        </template>

        <div class="dropdown-item" @click.stop="onOpenKeyboardShortcuts(); moreMenu = false">
          {{ $t('keyboard_shortcuts') }}
        </div>

        <div
          v-for="item in sortItems"
          :key="item.value"
          class="dropdown-item"
          :class="{ 'selected': item.value === sortBy }"
          @click.stop="onSort(item.value); moreMenu = false"
        >
          {{ $t(item.label) }}
        </div>
      </v-dropdown>
    </template>

    <ViewToggleButtons
      v-else-if="showViewToggle && !hideViewToggle"
      :card-view="safeCardView"
      @update:card-view="(value: boolean) => onUpdateCardView(value)"
    />
  </template>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ViewToggleButtons from '@/components/ViewToggleButtons.vue'
import UIModeToggleButton from '@/components/UIModeToggleButton.vue'
import ViewOptionsPanel from '@/components/media/ViewOptionsPanel.vue'

type UIMode = 'view' | 'edit'
type SortItem = { label: string; value: string }
type GroupByItem = { label: string; value: string }
type Placement = 'top' | 'secondary'

const props = defineProps<{
  placement: Placement

  uiMode: UIMode
  filterTrash: boolean
  isPhone: boolean
  checked: boolean

  uploadMenuVisible: boolean
  moreMenuVisible: boolean

  sortBy: string
  sortItems: SortItem[]

  showViewToggle: boolean
  cardView?: boolean

  onToggleUiMode?: () => void
  onUploadFiles?: () => void
  onUploadDir?: () => void
  onOpenKeyboardShortcuts?: () => void
  onSort: (value: string) => void
  onUpdateCardView?: (value: boolean) => void

  hideMoreMenu?: boolean
  hideViewToggle?: boolean

  // ViewOptionsPanel
  showViewOptions?: boolean
  showGroupBy?: boolean
  groupByItems?: GroupByItem[]
  groupBy?: string
  scrollPaging?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:uploadMenuVisible', value: boolean): void
  (e: 'update:moreMenuVisible', value: boolean): void
  (e: 'update:groupBy', value: string): void
  (e: 'update:scrollPaging', value: boolean): void
}>()

const uploadMenu = computed({
  get: () => props.uploadMenuVisible,
  set: (value: boolean) => emit('update:uploadMenuVisible', value),
})

const moreMenu = computed({
  get: () => props.moreMenuVisible,
  set: (value: boolean) => emit('update:moreMenuVisible', value),
})

const noop = () => {}

const onToggleUiMode = props.onToggleUiMode ?? noop
const onUploadFiles = props.onUploadFiles ?? noop
const onUploadDir = props.onUploadDir ?? noop
const onOpenKeyboardShortcuts = props.onOpenKeyboardShortcuts ?? noop
const onUpdateCardView = props.onUpdateCardView ?? noop

const safeCardView = computed(() => props.cardView ?? false)
</script>
