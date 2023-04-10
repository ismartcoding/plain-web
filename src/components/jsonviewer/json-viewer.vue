<template>
  <div class="jv-container" :class="themeClass">
    <div class="jv-code">
      <json-box :value="value" :expand-depth="expandDepth" />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, watch } from 'vue'
import { useTempStore } from '@/stores/temp'

const tempStore = useTempStore()
defineProps({
  value: {
    type: [Object, Array, String, Number, Boolean, Function],
    required: true,
  },
  expandDepth: {
    type: Number,
    default: 1,
  },
})

const themeClass = ref('light')

watch(
  () => tempStore.dark,
  (current: boolean) => {
    themeClass.value = current ? 'dark' : 'light'
  }
)
</script>

<style lang="scss">
.jv-container {
  position: relative;
  height: 100%;
  overflow: auto;
  white-space: nowrap;

  .jv-ellipsis {
    display: inline-block;
    line-height: 0.9;
    font-size: 0.9em;
    padding: 0px 4px 2px 4px;
    margin: 0 4px;
    border-radius: 3px;
    vertical-align: 2px;
    cursor: pointer;
    user-select: none;
  }

  .jv-key {
    margin-right: 4px;
  }

  .jv-code {
    overflow: hidden;
    padding: 16px;
  }

  .jv-item.jv-string {
    word-break: break-word;
    white-space: normal;
  }

  .jv-toggle {
    cursor: pointer;
    width: 0;
    height: 0;
    border-width: 5px 0 5px 9px;
    border-color: transparent transparent transparent var(--border-color);
    border-style: solid;
    margin-right: 4px;
    display: inline-block;

    &.open {
      transform: rotate(90deg);
    }
  }
}

.jv-container.light {
  background: #fff;
  color: #525252;

  .jv-ellipsis {
    color: #999;
    background-color: #eee;
  }

  .jv-key {
    color: #111111;
  }
}

.jv-container.dark {
  background: #282c34;
  color: #fff;

  .jv-ellipsis {
    color: #f8f8f8;
    background-color: #2c3e50;
  }

  .jv-key {
    color: #fff;
  }

  /**dark */
  .jv-item.jv-array {
    color: #111111;
  }

  .jv-item.jv-array {
    color: #fff;
  }

  .jv-item.jv-boolean {
    color: #fc1e70;
  }

  .jv-item.jv-function {
    color: #067bca;
  }

  .jv-item.jv-number {
    color: #fc1e70;
  }

  .jv-item.jv-object {
    color: #fff;
  }

  .jv-item.jv-undefined {
    color: #e08331;
  }

  .jv-item.jv-string {
    color: #42b983;

    .jv-link {
      color: #0366d6;
    }
  }

  .jv-code .jv-toggle:hover:before {
    background: #eee;
  }
}

.jv-container.light {
  .jv-item.jv-array {
    color: #111111;
  }

  .jv-item.jv-boolean {
    color: #fc1e70;
  }

  .jv-item.jv-function {
    color: #067bca;
  }

  .jv-item.jv-number {
    color: #fc1e70;
  }

  .jv-item.jv-object {
    color: #111111;
  }

  .jv-item.jv-undefined {
    color: #e08331;
  }

  .jv-item.jv-string {
    color: #42b983;

    .jv-link {
      color: #0366d6;
    }
  }

  .jv-code .jv-toggle:hover:before {
    background: #eee;
  }
}
</style>
