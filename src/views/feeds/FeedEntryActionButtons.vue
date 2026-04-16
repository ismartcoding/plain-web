<template>
  <div class="action-buttons">
    <v-icon-button v-tooltip="$t('add_to_tags')" class="sm" style="margin-inline-start: 16px" @click.prevent="$emit('addToTags')">
      <i-material-symbols:label-outline-rounded />
    </v-icon-button>
    <v-icon-button v-tooltip="$t('sync_content')" :loading="syncContentLoading" @click.prevent="$emit('syncContent')">
      <i-material-symbols:sync-rounded />
    </v-icon-button>
    <a v-tooltip="$t('view_original_article')" :href="entryUrl" class="btn-icon" target="_blank">
      <v-icon-button class="sm">
        <i-material-symbols:open-in-new-rounded />
      </v-icon-button>
    </a>
    <v-icon-button v-tooltip="$t('save_to_notes')" class="sm" @click.prevent="$emit('saveToNotes')">
      <i-material-symbols:add-notes-outline-rounded />
    </v-icon-button>
    <v-icon-button v-tooltip="$t('print')" class="sm" @click.prevent="$emit('print')">
      <i-material-symbols:print-outline-rounded />
    </v-icon-button>
    <v-dropdown v-model="fontSizeMenuVisible">
      <template #trigger>
        <v-icon-button v-tooltip="$t('font_size')" class="sm">
          <i-material-symbols:format-size-rounded />
        </v-icon-button>
      </template>
      <div class="dropdown-item" @click="$emit('decreaseFontSize')">
        <i-material-symbols:text-decrease-rounded />
        {{ $t('decrease_font_size') }}
      </div>
      <div class="dropdown-item" @click="$emit('increaseFontSize')">
        <i-material-symbols:text-increase-rounded />
        {{ $t('increase_font_size') }}
      </div>
      <div class="dropdown-item" @click="$emit('resetFontSize')">
        <i-material-symbols:refresh-rounded />
        {{ $t('reset_font_size') }}
      </div>
    </v-dropdown>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

interface Props {
  entryUrl?: string
  syncContentLoading: boolean
}

defineProps<Props>()

defineEmits<{
  addToTags: []
  syncContent: []
  saveToNotes: []
  print: []
  decreaseFontSize: []
  increaseFontSize: []
  resetFontSize: []
}>()

const { t } = useI18n()
const fontSizeMenuVisible = ref(false)
</script>

<style lang="scss" scoped>
.action-buttons {
  display: flex;
  align-items: center;
  gap: 4px;
}
</style> 