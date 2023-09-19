<template>
  <div v-click-away="deactivate" :class="{ active: isOpen && filteredOptions.length }" class="multiselect">
    <div @click.stop="toggle()" class="toggle"></div>
    <div class="tags" @click="toggle">
      <span v-for="(option, index) in props.modelValue" :track-by="index" class="tag">
        <span v-text="getOptionLabel(option)"></span>
        <i aria-hidden="true" tabindex="1" @click.stop="removeElement(option)" class="tag-icon"> </i>
      </span>
    </div>
    <ul transition="multiselect" v-show="isOpen" class="content">
      <li v-for="option in filteredOptions">
        <span @click.prevent="select(option)" class="option" v-text="getOptionLabel(option)"> </span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import type { ITag } from '@/lib/interfaces'
import { remove } from 'lodash'
import { computed, ref } from 'vue'

const props = defineProps({
  options: {
    type: Array,
    required: true,
  },
  modelValue: {
    type: Array,
    required: true,
  },
  key: {
    type: String,
    default: 'id',
  },
  label: {
    type: String,
    default: '',
  },
  placeholder: {
    type: String,
    default: 'Select option',
  },
  allowEmpty: {
    type: Boolean,
    default: true,
  },
})

const isOpen = ref(false)
const emit = defineEmits(['update:modelValue'])

const filteredOptions = computed<any[]>(() => {
  return props.options.filter(isNotSelected)
})

const valueKeys = computed(() => {
  if (props.key) {
    return props.modelValue.map((it: any) => it[props.key])
  } else {
    return props.modelValue
  }
})

function isSelected(option: any) {
  if (!props.modelValue.length) return false
  const opt = props.key ? option[props.key] : option
  return valueKeys.value.indexOf(opt) > -1
}

function isNotSelected(option: any) {
  return !isSelected(option)
}

function getOptionLabel(option: any) {
  if (typeof option === 'object' && option !== null) {
    if (props.label && option[props.label]) {
      return option[props.label]
    } else if (option.label) {
      return option.label
    }
  } else {
    return option
  }
}
function select(option: any) {
  const value = [...props.modelValue]
  value.push(option)
  emit('update:modelValue', value)
  deactivate()
}

function removeElement(option: any) {
  const value = [...props.modelValue]
  if (!props.allowEmpty && value.length <= 1) return
  remove(value as ITag[], (it: ITag) => it.id === option.id)
  emit('update:modelValue', value)
}

function activate() {
  isOpen.value = true
}

function deactivate() {
  isOpen.value = false
}

function toggle() {
  isOpen.value ? deactivate() : activate()
}
</script>

<style lang="scss" scoped>
.multiselect {
  font-size: 0.875rem;
  position: relative;
  min-height: 38px;
  border: 1px solid var(--md-sys-color-outline);
  background-color: var(--md-sys-color-surface);
  border-radius: var(--border-radius-sm);

  .tags {
    min-height: 36px;
    display: block;
    padding: 8px 40px 0 8px;
    border-radius: var(--border-radius-sm);
  }

  &.active {
    z-index: 50;
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;

    .tag-input,
    .tags {
      border-bottom-left-radius: 0;
      border-bottom-right-radius: 0;
    }

    .toggle {
      transform: rotateZ(180deg);
    }
  }
}

.multiselect:focus {
  outline: none;
}

.tag {
  position: relative;
  display: inline-block;
  padding: 4px 26px 4px 10px;
  border-radius: 5px;
  margin-right: 10px;
  line-height: 1;
  border: 1px solid var(--md-sys-color-outline);
  margin-bottom: 8px;

  & ~ .tag-input {
    width: auto;
  }
}

.tag-icon {
  cursor: pointer;
  margin-left: 7px;
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  font-weight: 700;
  font-style: initial;
  width: 22px;
  text-align: center;
  line-height: 22px;
  transition: all 0.2s ease;
  border-radius: 5px;

  &::after {
    content: '×';
    font-size: 0.875rem;
  }
}

.toggle {
  line-height: 16px;
  display: block;
  position: absolute;
  box-sizing: border-box;
  width: 40px;
  height: 36px;
  right: 1px;
  top: 1px;
  padding: 4px 8px;
  margin: 0;
  text-decoration: none;
  text-align: center;
  cursor: pointer;
  transition: transform 0.2s ease;

  &:before {
    position: relative;
    right: 0;
    top: 65%;
    margin-top: 4px;
    border-style: solid;
    border-width: 5px 5px 0 5px;
    border-color: var(--md-sys-color-outline) transparent transparent transparent;
    content: '';
  }
}

.content {
  position: absolute;
  list-style: none;
  display: block;
  background: var(--md-sys-color-surface);
  width: calc(100% + 2px);
  max-height: 300px;
  overflow: auto;
  padding: 0;
  margin: 0 0 0 -1px;
  border: 1px solid var(--md-sys-color-outline);
  border-top: none;
  border-bottom-left-radius: var(--border-radius-sm);
  border-bottom-right-radius: var(--border-radius-sm);
  z-index: 50;

  &::webkit-scrollbar {
    display: none;
  }

  &:empty {
    display: none;
  }
}

.option {
  display: block;
  padding: 12px;
  min-height: 40px;
  line-height: 16px;
  text-decoration: none;
  text-transform: none;
  position: relative;
  cursor: pointer;
}
</style>
