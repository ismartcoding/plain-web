<template>
  <v-modal @close="close">
    <template #headline>{{ $t('create_channel') }}</template>
    <template #content>
      <v-text-field v-model="name" :label="$t('channel_name')" autofocus @keydown.enter="save" />
    </template>
    <template #actions>
      <v-outlined-button @click="close">{{ $t('cancel') }}</v-outlined-button>
      <v-filled-button :loading="loading" :disabled="!name.trim()" @click="save">{{ $t('save') }}</v-filled-button>
    </template>
  </v-modal>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { popModal } from '@/components/modal'
import { initMutation, createChatChannelGQL } from '@/lib/api/mutation'

const emit = defineEmits<{
  (e: 'created', channel: any): void
}>()

const name = ref('')

const { mutate, loading, onDone } = initMutation({
  document: createChatChannelGQL,
})

onDone((r: any) => {
  emit('created', { ...r.data.createChatChannel })
  popModal()
})

function save() {
  if (!name.value.trim()) return
  mutate({ name: name.value.trim() })
}

function close() {
  popModal()
}
</script>
