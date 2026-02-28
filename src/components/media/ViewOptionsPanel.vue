<template>
  <v-dropdown v-model="isOpen">
    <template #trigger>
      <v-icon-button v-tooltip="$t('view_options')">
        <i-material-symbols:tune-rounded />
      </v-icon-button>
    </template>

    <div class="view-options-panel">
      <!-- Keyboard Shortcuts -->
      <div class="panel-section">
        <div class="dropdown-item panel-action-item" @click="handleKeyboardShortcuts">
          <i-material-symbols:keyboard-outline-rounded class="panel-item-icon" />
          {{ $t('keyboard_shortcuts') }}
        </div>
      </div>

      <!-- Group By -->
      <template v-if="showGroupBy && (groupByItems?.length ?? 0) > 0">
        <div class="panel-divider" />
        <div class="panel-section">
          <div class="panel-section-title">{{ $t('group_by.label') }}</div>
          <div
            v-for="item in groupByItems"
            :key="item.value"
            class="dropdown-item option-row"
            @click="emit('update:groupBy', item.value)"
          >
            <i-material-symbols:radio-button-checked v-if="groupBy === item.value" class="radio-icon active" />
            <i-material-symbols:radio-button-unchecked v-else class="radio-icon" />
            {{ $t(item.label) }}
          </div>
        </div>
      </template>

      <div class="panel-divider" />

      <!-- Paging Mode -->
      <div class="panel-section">
        <div class="panel-section-title">{{ $t('paging.label') }}</div>
        <div
          class="dropdown-item option-row"
          :class="{ 'option-disabled': isGroupMode }"
          @click="handleNumberPaging"
        >
          <i-material-symbols:radio-button-checked v-if="!effectiveScrollPaging" class="radio-icon active" />
          <i-material-symbols:radio-button-unchecked v-else class="radio-icon" />
          {{ $t('paging.number') }}
        </div>
        <div class="dropdown-item option-row" @click="emit('update:scrollPaging', true)">
          <i-material-symbols:radio-button-checked v-if="effectiveScrollPaging" class="radio-icon active" />
          <i-material-symbols:radio-button-unchecked v-else class="radio-icon" />
          {{ $t('paging.scroll') }}
        </div>
      </div>

      <!-- Sort By – hidden when grouped -->
      <template v-if="!isGroupMode">
        <div class="panel-divider" />
        <div class="panel-section">
          <div class="panel-section-title">{{ $t('sort') }}</div>
          <div
            v-for="item in sortItems"
            :key="item.value"
            class="dropdown-item option-row"
            @click="emit('update:sortBy', item.value)"
          >
            <i-material-symbols:radio-button-checked v-if="sortBy === item.value" class="radio-icon active" />
            <i-material-symbols:radio-button-unchecked v-else class="radio-icon" />
            {{ $t(item.label) }}
          </div>
        </div>
      </template>
    </div>
  </v-dropdown>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

type SortItem = { label: string; value: string }
type GroupByItem = { label: string; value: string }

const props = defineProps<{
  showGroupBy?: boolean
  groupByItems?: GroupByItem[]
  groupBy?: string
  scrollPaging: boolean
  sortBy: string
  sortItems: SortItem[]
  onOpenKeyboardShortcuts: () => void
}>()

const emit = defineEmits<{
  (e: 'update:groupBy', value: string): void
  (e: 'update:scrollPaging', value: boolean): void
  (e: 'update:sortBy', value: string): void
}>()

const isOpen = ref(false)

const isGroupMode = computed(() => !!props.groupBy && props.groupBy !== '')
const effectiveScrollPaging = computed(() => isGroupMode.value || props.scrollPaging)

function handleKeyboardShortcuts() {
  isOpen.value = false
  props.onOpenKeyboardShortcuts()
}

function handleNumberPaging() {
  if (!isGroupMode.value) {
    emit('update:scrollPaging', false)
  }
}
</script>

<style scoped>
.view-options-panel {
  width: 280px;
  white-space: normal;
  padding: 4px 0;
}

.panel-section {
  padding: 2px 0;
}

.panel-section-title {
  padding: 8px 16px 4px;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--md-sys-color-outline);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  user-select: none;
}

.panel-divider {
  height: 1px;
  background: var(--md-sys-color-outline-variant);
  margin: 4px 0;
}

.panel-action-item {
  gap: 12px;
}

.panel-item-icon {
  font-size: 1.2rem;
  color: var(--md-sys-color-on-surface-variant);
}

.option-row {
  gap: 12px;
}

.radio-icon {
  font-size: 1.2rem;
  flex-shrink: 0;
  color: var(--md-sys-color-on-surface-variant);

  &.active {
    color: var(--md-sys-color-primary);
  }
}

.option-disabled {
  opacity: 0.38;
  cursor: not-allowed;

  &:hover {
    background-color: transparent;
  }
}
</style>
