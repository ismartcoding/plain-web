<template>
  <div class="theme-changer">
    <div class="button-group">
      <button 
        :class="{ 'selected': selectedColorMode === 'dark' }"
        @click="selectColorMode('dark')">
        <i-material-symbols:dark-mode-outline-rounded />
      </button>
      <button 
        :class="{ 'selected': selectedColorMode === 'auto' }"
        @click="selectColorMode('auto')">
        <i-material-symbols:brightness-6-outline-rounded />
      </button>
      <button 
        :class="{ 'selected': selectedColorMode === 'light' }"
        @click="selectColorMode('light')">
        <i-material-symbols:sunny-outline-rounded />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { changeColorMode, getCurrentMode } from '@/lib/theme'
import type { ColorMode } from '@/lib/theme'
import { ref } from 'vue'

const selectedColorMode = ref(getCurrentMode() || 'auto')

function selectColorMode(value: ColorMode) {
  selectedColorMode.value = value
  changeColorMode(value)
}
</script>

<style lang="scss" scoped>
.theme-changer {
  margin: 12px 16px;
}
</style>
