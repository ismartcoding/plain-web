<template>
  <div class="search-input">
    <md-outlined-text-field id="input-ref" type="search" data-search-input="true" :value="modelValue" @input="onInput" @focus="onFocus" @blur="hasFocus = false" @keyup.enter="props.search" :placeholder="$t('search_hint')">
      <i-material-symbols:search-rounded slot="leading-icon" />
      <button class="icon-button" ref="moreButton" slot="trailing-icon" @click.prevent="() => (searchPanelVisible = true)">
        <md-ripple />
        <i-material-symbols:tune-rounded />
      </button>
    </md-outlined-text-field>
    <md-menu anchor="input-ref" menu-corner="start-end" anchor-corner="end-end" stay-open-on-focusout quick :open="searchPanelVisible" @closed="() => (searchPanelVisible = false)">
      <slot name="filters" />
    </md-menu>
  </div>
</template>

<script setup lang="ts">
import { ref, type PropType } from 'vue'

const props = defineProps({
  modelValue: {
    type: String,
    default: '',
  },
  search: {
    type: Function as PropType<() => void>,
    required: true,
  },
})

const emit = defineEmits(['update:modelValue'])

const hasFocus = ref(false)
const searchPanelVisible = ref(false)

const onInput = (e: Event) => {
  emit('update:modelValue', (e.target as HTMLInputElement).value)
}

function onFocus() {
  hasFocus.value = true
}

defineExpose({ dismiss: () => (searchPanelVisible.value = false) })
</script>

<style lang="scss" scoped>
.search-input {
  position: relative;
  margin-inline-start: 16px;
  md-outlined-text-field {
    --_top-space: 8px;
    --_bottom-space: 8px;
  }
}
</style>
