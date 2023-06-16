<template>
  <div class="dropdown" v-click-away="() => (menuVisible = false)" :title="$t('more')">
    <button class="btn" type="button" @click.prevent="() => (menuVisible = !menuVisible)">
      <i-material-symbols:more-vert class="bi" />
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
<style lang="scss" scoped>
.btn {
  height: 100%;
}
</style>