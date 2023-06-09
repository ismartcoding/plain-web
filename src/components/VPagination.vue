<template>
  <ul class="pagination">
    <li class="page-item" :class="{ disabled: !isPrevActive }">
      <a class="page-link" href="#" @click.prevent="prev">&laquo;</a>
    </li>
    <li v-for="page in pagination" class="page-item" :class="{ disabled: page === null, active: page === modelValue }">
      <span class="page-link" v-if="page === null">···</span>
      <a v-else class="page-link" href="#" @click.prevent="go(page)">
        {{ page }}
      </a>
    </li>
    <li class="page-item" :class="{ disabled: !isNextActive }">
      <a class="page-link" href="#" @click.prevent="next">&raquo;</a>
    </li>
  </ul>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps({
  total: {
    type: Number,
    default: 0,
  },
  limit: {
    type: Number,
    default: 50,
  },
  rangeSize: {
    type: Number,
    default: 2,
  },
  modelValue: {
    type: Number,
    default: 0,
  },
})

function go(value: number) {
  emit('update:modelValue', value)
}

const pages = computed(() => {
  return Math.ceil(props.total / props.limit)
})

const emit = defineEmits(['update:modelValue'])
const pagination = computed((): (number | null)[] => {
  const res = []
  const minPaginationElems = 5 + props.rangeSize * 2

  let rangeStart = pages.value <= minPaginationElems ? 1 : props.modelValue - props.rangeSize
  let rangeEnd = pages.value <= minPaginationElems ? pages.value : props.modelValue + props.rangeSize

  rangeEnd = rangeEnd > pages.value ? pages.value : rangeEnd
  rangeStart = rangeStart < 1 ? 1 : rangeStart

  if (pages.value > minPaginationElems) {
    const isStartBoundaryReached = rangeStart - 1 < 3
    const isEndBoundaryReached = pages.value - rangeEnd < 3

    if (isStartBoundaryReached) {
      rangeEnd = minPaginationElems - 2
      for (let i = 1; i < rangeStart; i++) {
        res.push(i)
      }
    } else {
      res.push(1)
      res.push(null)
    }

    if (isEndBoundaryReached) {
      rangeStart = pages.value - (minPaginationElems - 3)
      for (let i = rangeStart; i <= pages.value; i++) {
        res.push(i)
      }
    } else {
      for (let i = rangeStart; i <= rangeEnd; i++) {
        res.push(i)
      }
      res.push(null)
      res.push(pages.value)
    }
  } else {
    for (let i = rangeStart; i <= rangeEnd; i++) {
      res.push(i)
    }
  }

  return res
})

const isPrevActive = computed((): boolean => {
  return props.modelValue > 1
})

const isNextActive = computed((): boolean => {
  return props.modelValue < pages.value
})

function prev(): void {
  if (isPrevActive.value) {
    emit('update:modelValue', props.modelValue - 1)
  }
}

function next(): void {
  if (isNextActive.value) {
    emit('update:modelValue', props.modelValue + 1)
  }
}
</script>
