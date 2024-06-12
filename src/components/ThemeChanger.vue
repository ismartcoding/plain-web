<template>
  <div class="theme-changer">
    <div>
      <label id="hex">
        <span class="label">{{ $t('color') }}</span>
        <span class="input-wrapper">
          <div class="overflow">
            <input id="color-input" @input="onHexPickerInput" type="color" :value="hexColor" />
          </div>
          <md-focus-ring for="color-input"></md-focus-ring>
        </span>
      </label>
    </div>
    <md-outlined-segmented-button-set>
      <md-outlined-segmented-button data-value="dark" :selected="selectedColorMode === 'dark'" @click="selectColrMode('dark')">
        <i-material-symbols:dark-mode-outline-rounded slot="icon" />
      </md-outlined-segmented-button>
      <md-outlined-segmented-button data-value="auto" :selected="selectedColorMode === 'auto'" @click="selectColrMode('auto')">
        <i-material-symbols:brightness-6-outline-rounded slot="icon" />
      </md-outlined-segmented-button>
      <md-outlined-segmented-button data-value="light" :selected="selectedColorMode === 'light'" @click="selectColrMode('light')">
        <i-material-symbols:sunny-outline-rounded slot="icon" />
      </md-outlined-segmented-button>
    </md-outlined-segmented-button-set>
  </div>
</template>
<script setup lang="ts">
import { changeColor, changeColorMode, getCurrentMode, getCurrentSeedColor } from '@/lib/theme/theme.js'
import type { ColorMode } from '@/lib/theme/theme.js'
import { ref } from 'vue'
import type { MdOutlinedSegmentedButton } from '@material/web/labs/segmentedbutton/outlined-segmented-button.js'
import '@material/web/labs/segmentedbuttonset/outlined-segmented-button-set.js'
import '@material/web/labs/segmentedbutton/outlined-segmented-button.js'

const hexColor = ref(getCurrentSeedColor())
const selectedColorMode = ref(getCurrentMode())
function selectColrMode(value: ColorMode) {
  selectedColorMode.value = value
  changeColorMode(value)
}

function onHexPickerInput(e: Event) {
  hexColor.value = (e.target as HTMLInputElement).value
  changeColor(hexColor.value)
}
</script>

<style lang="scss" scoped>
.theme-changer {
  position: relative;
  display: flex;
  flex-direction: column;
  margin: 12px 16px;
}

.theme-changer > * {
  margin-block-end: 16px;
}

.theme-changer > *:last-child {
  margin-block-end: 0;
}

input {
  border: none;
  background: none;
}

#hex {
  border-radius: var(--pl-shape-l);
  background-color: var(--md-sys-color-surface-variant);
  color: var(--md-sys-color-on-surface-variant);

  /* Default track color is inaccessible in a surface-variant */
  --md-slider-inactive-track-color: var(--md-sys-color-on-surface-variant);
  display: flex;
  padding: 12px 24px;
  align-items: center;
}

#hex .label {
  flex-grow: 1;
}

#hex .input-wrapper {
  box-sizing: border-box;
  width: 48px;
  height: 48px;
  box-sizing: border-box;
  border: 1px solid var(--md-sys-color-on-secondary-container);
  position: relative;
}

#hex .input-wrapper,
#hex md-focus-ring {
  border-radius: 50%;
}

.overflow {
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: inherit;
  display: flex;
  align-items: center;
  justify-content: center;
}

#hex input {
  min-width: 200%;
  min-height: 200%;
}
</style>
