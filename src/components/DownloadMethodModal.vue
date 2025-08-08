<template>
  <v-modal @close="popModal">
    <template #content>
      {{ $t('choose_download_method') }}
    </template>
    <template #actions>
      <v-outlined-button @click="popModal">{{ $t('cancel') }}</v-outlined-button>
      <v-outlined-button @click="onEachClick">{{ $t('download_individually') }}</v-outlined-button>
      <v-filled-button @click="onZipClick">{{ $t('download_as_zip') }}</v-filled-button>
    </template>
  </v-modal>
  
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { popModal } from './modal'

const props = defineProps({
  onEach: { type: Function as PropType<() => void>, required: true },
  onZip: { type: Function as PropType<() => void>, required: true },
})

function onEachClick() {
  props.onEach()
  popModal()
}

function onZipClick() {
  props.onZip()
  popModal()
}
</script>


