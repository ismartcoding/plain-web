<template>
  <div class="alert-info alert-all-checked" :class="{ show: allCheckedAlertVisible || realAllChecked }">
    <template v-if="allCheckedAlertVisible">
      {{ $t('all_items_on_this_page_are_selected', { count: limit }) }}
      <a href="#" @click.prevent="selectRealAll">{{ $t('select_all_items', { count: total }) }}</a>
    </template>
    <template v-else>
      {{ $t('all_items_are_selected', { count: total }) }}
      <a href="#" @click.prevent="clearSelection">{{ $t('clear_selection') }}</a>
    </template>
  </div>
</template>
<script setup lang="ts">
import type { PropType } from 'vue'

defineProps({
  limit: { type: Number, required: true },
  total: { type: Number, required: true },
  allCheckedAlertVisible: { type: Boolean, required: true },
  realAllChecked: { type: Boolean, required: true },
  selectRealAll: {
    type: Function as PropType<() => void>,
    default: () => {},
  },
  clearSelection: {
    type: Function as PropType<() => void>,
    default: () => {},
  },
})
</script>
