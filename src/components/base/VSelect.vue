<template>
  <div 
    ref="selectRef"
    :class="['v-select', {
      'v-select--disabled': disabled,
      'v-select--focused': focused,
      'v-select--open': isOpen,
      'v-select--error': error
    }]"
    tabindex="0"
    @click="toggle"
    @keydown="onKeydown"
  >
    <fieldset class="v-select__border">
      <legend v-if="label" class="v-select__legend">{{ label }}</legend>
    </fieldset>
    
    <div class="v-select__content">
      <span v-if="displayText" class="v-select__text">{{ displayText }}</span>
      <span v-else-if="placeholder" class="v-select__placeholder">{{ placeholder }}</span>
    </div>
    
    <svg class="v-select__arrow" :class="{ 'v-select__arrow--open': isOpen }" viewBox="0 0 24 24">
      <path d="M7 10L12 15L17 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    </svg>

    <Teleport to="body">
      <div v-if="isOpen" ref="menuRef" class="v-select-menu" :style="menuStyle">
        <div 
          v-for="option in options" 
          :key="option.value"
          :class="['v-select-option', {
            'v-select-option--selected': option.value === modelValue,
            'v-select-option--disabled': option.disabled
          }]"
          @click="selectOption(option)"
        >
          {{ option.label }}
          <svg v-if="option.value === modelValue" class="v-select-option__check" viewBox="0 0 24 24">
            <path d="M9 16.17L4.83 12L3.41 13.41L9 19L21 7L19.59 5.59L9 16.17Z" fill="currentColor"/>
          </svg>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, nextTick, onMounted, onUnmounted } from 'vue'

interface Option {
  value: string | number
  label: string
  disabled?: boolean
}

interface Props {
  modelValue?: string | number
  label?: string
  placeholder?: string
  disabled?: boolean
  error?: boolean
  options?: Option[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: string | number]
  'change': [value: string | number]
}>()

const selectRef = ref<HTMLElement>()
const menuRef = ref<HTMLElement>()
const isOpen = ref(false)
const focused = ref(false)
const menuStyle = ref({})

const displayText = computed(() => {
  if (!props.modelValue || !props.options) return ''
  return props.options.find(opt => opt.value === props.modelValue)?.label || ''
})

const close = () => {
  isOpen.value = false
  focused.value = false
}

const open = async () => {
  if (props.disabled) return
  
  isOpen.value = true
  focused.value = true
  
  await nextTick()
  
  if (selectRef.value) {
    const rect = selectRef.value.getBoundingClientRect()
    menuStyle.value = {
      position: 'fixed',
      top: `${rect.bottom + 4}px`,
      left: `${rect.left}px`,
      minWidth: `${rect.width}px`,
      maxHeight: '50vh',
      zIndex: 9999
    }
  }
}

const toggle = () => {
  if (props.disabled) return
  isOpen.value ? close() : open()
}

const selectOption = (option: Option) => {
  if (option.disabled) return
  
  emit('update:modelValue', option.value)
  emit('change', option.value)
  close()
}

const onKeydown = (event: KeyboardEvent) => {
  if (props.disabled) return
  
  switch (event.key) {
    case 'Enter':
    case ' ':
      event.preventDefault()
      toggle()
      break
    case 'Escape':
      if (isOpen.value) {
        event.preventDefault()
        close()
      }
      break
    case 'ArrowDown':
    case 'ArrowUp':
      event.preventDefault()
      if (!isOpen.value) open()
      break
  }
}

const onClickOutside = (event: Event) => {
  if (isOpen.value && 
      selectRef.value && 
      !selectRef.value.contains(event.target as Node) &&
      (!menuRef.value || !menuRef.value.contains(event.target as Node))) {
    close()
  }
}

onMounted(() => {
  document.addEventListener('click', onClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', onClickOutside)
})
</script>

<style lang="scss" scoped>
.v-select {
  position: relative;
  display: inline-flex;
  align-items: center;
  min-width: 120px;
  padding: 0 16px;
  height: 64px;
  cursor: pointer;
  
  &--disabled {
    cursor: default;
    opacity: 0.38;
    pointer-events: none;
  }
  
  &__border {
    position: absolute;
    inset: 0;
    margin: 0;
    padding: 0;
    border: 1px solid var(--md-sys-color-outline);
    border-radius: 4px;
    pointer-events: none;
    transition: all 0.2s ease;
  }
  
  &__legend {
    margin-left: 8px;
    padding: 0 4px;
    font-size: 12px;
    color: var(--md-sys-color-on-surface-variant);
    background: var(--outlined-field-bg, var(--md-sys-color-surface, #fffbfe));
  }
  
  &__content {
    flex: 1;
    display: flex;
    align-items: center;
    margin-top: 8px;
  }
  
  &__text {
    font-size: 16px;
    color: var(--md-sys-color-on-surface);
  }
  
  &__placeholder {
    font-size: 16px;
    color: var(--md-sys-color-on-surface-variant);
  }
  
  &__arrow {
    width: 24px;
    height: 24px;
    margin-left: 12px;
    margin-top: 8px;
    color: var(--md-sys-color-on-surface-variant);
    transition: transform 0.2s ease;
    
    &--open {
      transform: rotate(180deg);
    }
  }
  
  // 悬停状态
  &:hover:not(&--disabled) &__border {
    border-color: var(--md-sys-color-on-surface);
  }
  
  &--focused &__border {
    border-color: var(--md-sys-color-primary);
    border-width: 2px;
  }
  
  &--focused &__legend {
    color: var(--md-sys-color-primary);
  }
  
  &--error &__border {
    border-color: var(--md-sys-color-error);
  }
  
  &--error &__legend {
    color: var(--md-sys-color-error);
  }
}
</style>

<style lang="scss">
.v-select-menu {
  background: var(--md-sys-color-surface-container);
  border-radius: 4px;
  box-shadow: var(--md-sys-elevation-shadow-2);
  overflow: hidden;
  padding: 8px 0;
  max-height: inherit;
  overflow-y: auto;
}

.v-select-option {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  cursor: pointer;
  color: var(--md-sys-color-on-surface);
  transition: background-color 0.15s ease;
  
  &:hover:not(&--disabled) {
    background: color-mix(in srgb, var(--md-sys-color-on-surface) 8%, transparent);
  }
  
  &--selected {
    background: color-mix(in srgb, var(--md-sys-color-primary) 12%, transparent);
    color: var(--md-sys-color-primary);
  }
  
  &--disabled {
    cursor: default;
    opacity: 0.38;
    pointer-events: none;
  }
  
  &__check {
    width: 18px;
    height: 18px;
    color: var(--md-sys-color-primary);
  }
}

.dark {
  .v-select-menu {
    background: var(--md-sys-color-surface-container-high);
  }
}
</style> 