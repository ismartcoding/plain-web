<template>
  <div class="dropdown" v-click-away="() => (menuVisible = false)">
    <button class="btn dropdown-toggle" type="button" @click.prevent="() => (menuVisible = !menuVisible)">
      {{ title }}
    </button>
    <ul class="dropdown-menu" v-show="menuVisible">
      <li v-for="(item, index) in items" :key="index">
        <a
          class="dropdown-item"
          href="#"
          @click.prevent="
            () => {
              menuVisible = false
              item.click()
            }
          "
          >{{ item.text }}</a
        >
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import type { IDropdownItem } from '@/lib/interfaces'
import { ref, type PropType } from 'vue'

const menuVisible = ref(false)
defineProps({
  title: { type: String, required: true },
  items: { type: Array as PropType<Array<IDropdownItem>>, required: true, default: () => [] },
})
</script>
