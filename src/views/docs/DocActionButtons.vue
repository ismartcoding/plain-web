<template>
  <div class="actions">
    <v-icon-button v-tooltip="$t('download')" class="sm" @click.stop="$emit('download-file', item.path)">
      <i-material-symbols:download-rounded />
    </v-icon-button>

    <v-icon-button v-tooltip="$t('delete')" class="sm" @click.stop="$emit('delete-item', item)">
      <i-material-symbols:delete-forever-outline-rounded />
    </v-icon-button>

    <v-dropdown v-model="infoVisible">
      <template #trigger>
        <v-icon-button v-tooltip="$t('info')" class="sm">
          <i-material-symbols:info-outline-rounded />
        </v-icon-button>
      </template>
      <section class="card card-info">
        <div class="key-value vertical">
          <div class="key">{{ $t('path') }}</div>
          <div class="value">{{ item.path }}</div>
        </div>
        <div class="key-value">
          <div class="key">{{ $t('size') }}</div>
          <div class="value">{{ formatFileSize(item.size) }}</div>
        </div>
        <div class="key-value">
          <div class="key">{{ $t('updated_at') }}</div>
          <div class="value">{{ formatDateTimeFull(item.updatedAt) }}</div>
        </div>
      </section>
    </v-dropdown>

    <v-dropdown v-model="moreVisible">
      <template #trigger>
        <v-icon-button v-tooltip="$t('actions')" class="sm">
          <i-material-symbols:more-vert />
        </v-icon-button>
      </template>
      <div class="dropdown-item" @click.stop="$emit('open-file', item); moreVisible = false">
        {{ $t('open') }}
      </div>
      <div class="dropdown-item" @click.stop="$emit('rename-item', item); moreVisible = false">
        {{ $t('rename') }}
      </div>
      <div class="dropdown-item" @click.stop="$emit('duplicate-item', item); moreVisible = false">
        {{ $t('duplicate') }}
      </div>
    </v-dropdown>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { IDoc } from '@/lib/interfaces'
import { formatFileSize, formatDateTimeFull } from '@/lib/format'

defineProps<{ item: IDoc }>()

defineEmits<{
  'download-file': [path: string]
  'delete-item': [item: IDoc]
  'open-file': [item: IDoc]
  'rename-item': [item: IDoc]
  'duplicate-item': [item: IDoc]
}>()

const infoVisible = ref(false)
const moreVisible = ref(false)
</script>
