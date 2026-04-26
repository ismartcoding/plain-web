<template>
  <div class="grids">
    <template v-for="item in homeFeatureCards" :key="item.id">
      <FeatureCard v-if="item.sectionType === 'feature'" :to="item.to" :title="$t(item.titleKey)" :count="item.count">
        <template #icon>
          <component :is="item.icon" />
        </template>
        <div v-if="item.showStorageInfo && counter.total >= 0" class="storage-info">
          {{ $t('storage_free_total', { free: formatFileSize(counter.free), total: formatFileSize(counter.total) }) }}
        </div>
      </FeatureCard>

      <div v-else-if="item.sectionType === 'clipboard'" class="card clipboard-card">
        <div class="card-content">
          <h5 class="card-title">{{ $t('send_to_phone_clipboard') }}</h5>
          <div class="phone-input-row">
            <v-text-field v-model="clipText" :label="$t('clipboard_text')" class="phone-input" :error="clipTextError" :error-text="$t('valid.required')" @keyup.enter="sendClipboard">
              <template #trailing-icon>
                <v-icon-button @click.prevent="pasteClipboardText">
                  <i-material-symbols:content-paste-rounded />
                </v-icon-button>
              </template>
            </v-text-field>
            <v-filled-button class="call-btn" :loading="setClipLoading" @click.prevent="sendClipboard">
              {{ $t('send') }}
            </v-filled-button>
          </div>
        </div>
      </div>

      <CallPhoneCard v-else />
    </template>
  </div>
</template>

<script setup lang="ts">
import { formatFileSize } from '@/lib/format'
import { computed } from 'vue'
import { useTempStore } from '@/stores/temp'
import { storeToRefs } from 'pinia'
import { buildQuery } from '@/lib/search'
import { encodeBase64 } from '@/lib/strutil'
import { useHomeData, useClipboardAction } from './home'
import { useHomeFeatureCards } from './useHomeFeatureCards'
import CallPhoneCard from './CallPhoneCard.vue'
import FeatureCard from './FeatureCard.vue'

const { app, counter } = storeToRefs(useTempStore())

const { mounts } = useHomeData()
const { clipText, clipTextError, setClipLoading, pasteClipboardText, sendClipboard } = useClipboardAction()

const filesPath = computed(() => {
  const internalRoot = mounts.value.find((m) => m.driveType === 'INTERNAL_STORAGE')?.mountPoint || app.value.internalStoragePath
  const q = buildQuery([
    { name: 'parent', op: '', value: internalRoot },
    { name: 'type', op: '', value: 'INTERNAL_STORAGE' },
    { name: 'root_path', op: '', value: internalRoot },
  ])
  return `/files?q=${encodeBase64(q)}`
})

const { homeFeatureCards } = useHomeFeatureCards(filesPath)
</script>

<style lang="scss" scoped src="./HomeView.scss"></style>
