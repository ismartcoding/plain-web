import { computed, type Ref } from 'vue'

type SortItem = { label: string; value: string }
type GroupByItem = { label: string; value: string }

export interface MediaPageActionsOptions {
  filterTrash: Ref<boolean>
  checked: Ref<boolean>
  sortBy: Ref<string>
  sortItems: SortItem[]
  onSort: (value: string) => void
  upload?: {
    dir: Ref<string>
    editable: Ref<boolean>
    onUploadFiles: () => void
    onUploadDir: () => void
    onEditDir: () => void
  }
  view?: {
    show?: boolean
    cardView: Ref<boolean>
    hide?: Ref<boolean>
    onUpdateCardView: (value: boolean) => void
  }
  options?: {
    show?: boolean
    showGroupBy?: boolean
    groupByItems?: GroupByItem[]
    groupBy?: Ref<string>
    scrollPaging: Ref<boolean>
    onUpdateGroupBy?: (value: string) => void
    onUpdateScrollPaging: (value: boolean) => void
  }
}

export function useMediaPageActions(options: MediaPageActionsOptions) {
  return computed(() => ({
    state: {
      filterTrash: options.filterTrash.value,
      checked: options.checked.value,
    },
    sort: {
      sortBy: options.sortBy.value,
      items: options.sortItems,
      onSort: options.onSort,
    },
    upload: options.upload && {
      dir: options.upload.dir.value,
      editable: options.upload.editable.value,
      onUploadFiles: options.upload.onUploadFiles,
      onUploadDir: options.upload.onUploadDir,
      onEditDir: options.upload.onEditDir,
    },
    view: options.view && {
      show: options.view.show ?? true,
      cardView: options.view.cardView.value,
      hide: options.view.hide?.value ?? false,
      onUpdateCardView: options.view.onUpdateCardView,
    },
    options: options.options && {
      show: options.options.show ?? true,
      showGroupBy: options.options.showGroupBy,
      groupByItems: options.options.groupByItems,
      groupBy: options.options.groupBy?.value,
      scrollPaging: options.options.scrollPaging.value,
      onUpdateGroupBy: options.options.onUpdateGroupBy,
      onUpdateScrollPaging: options.options.onUpdateScrollPaging,
    },
  }))
}
