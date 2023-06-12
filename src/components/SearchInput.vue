<template>
  <div class="search-input" v-click-away="() => (searchPanelVisible = false)">
    <i-material-symbols:search-rounded class="bi bi-search" />
    <input
      ref="inputRef"
      type="search"
      data-search-input="true"
      :value="modelValue"
      @input="onInput"
      @focus="onFocus"
      @blur="hasFocus = false"
      @keyup.enter="props.search"
      :placeholder="$t('search_hint')"
    />
    <i-material-symbols:tune-rounded
      class="bi bi-tune"
      @click.prevent="() => (searchPanelVisible = !searchPanelVisible)"
    />
    <div class="dropdown-menu search-panel" v-show="searchPanelVisible">
      <slot name="filters" />
    </div>
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
const inputRef = ref<null | HTMLInputElement>(null)
const searchPanelVisible = ref(false)

const onInput = (e: Event) => {
  emit('update:modelValue', (e.target as HTMLInputElement).value)
}

function onFocus() {
  hasFocus.value = true
}
</script>

<style lang="scss" scoped>
.search-input {
  position: relative;
  width: 400px;
  margin-left: 16px;

  input[type='search'] {
    border: 1px solid currentColor;
    border-radius: var(--border-radius-sm);
    color: var(--text-color);
    background-color: var(--back-color);
    display: block;
    width: 100%;
    padding: 6px 32px;
    font-size: 1rem;
    height: 38px;

    &:focus {
      outline: 0;
      box-shadow: none;
    }
  }

  .bi {
    position: absolute;
  }

  .bi-search {
    left: 8px;
    top: 10px;
  }

  .bi-tune {
    cursor: pointer;
    right: 8px;
    top: 10px;
  }
}

.search-panel {
  width: 400px;
  padding: 16px;
}

/* Fix the X appearing in search field on Chrome and IE */
input[type='search']::-ms-clear {
  display: none;
  width: 0;
  height: 0;
}

input[type='search']::-ms-reveal {
  display: none;
  width: 0;
  height: 0;
}

input[type='search']::-webkit-search-decoration,
input[type='search']::-webkit-search-cancel-button,
input[type='search']::-webkit-search-results-button,
input[type='search']::-webkit-search-results-decoration {
  display: none;
}
</style>
