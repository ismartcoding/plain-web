<template>
  <div class="v-toolbar">
    <ul class="v-tabs">
      <li v-for="(item, index) in tabs" :key="index" @click="swtichTab(index)" :class="{ active: currentTab === index }">
        {{ item.startsWith('t:') ? $t(item.slice(2)) : item }}
      </li>
    </ul>
    <button type="button" :disabled="loading" class="btn right-actions" @click="save">
      {{ $t(loading ? 'saving' : 'save') }}
    </button>
  </div>
</template>
<script setup lang="ts">
import { ref, type PropType } from 'vue'
const emit = defineEmits(['update:modelValue'])

const props = defineProps({
  modelValue: { type: Number, default: 0 },
  save: { type: Function as PropType<(payload: MouseEvent) => void> },
  loading: { type: Boolean },
  tabs: { type: Array as PropType<Array<string>>, default: () => [] },
})

const currentTab = ref(props.modelValue)

function swtichTab(tab: number) {
  currentTab.value = tab
  emit('update:modelValue', tab)
}
</script>
