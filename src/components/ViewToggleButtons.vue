<template>
  <div class="button-group">
    <button :class="{ 'selected': !isCardView }" @click="$emit('update:cardView', false)">
      <i-material-symbols:grid-view-outline-rounded />
    </button>
    <button :class="{ 'selected': isCardView }" @click="$emit('update:cardView', true)">
      <i-material-symbols:splitscreen-outline />
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  cardView: boolean
}

interface Emits {
  (e: 'update:cardView', value: boolean): void
}

const props = defineProps<Props>()
defineEmits<Emits>()

// Computed property to handle the card view state
const isCardView = computed(() => props.cardView)
</script> 