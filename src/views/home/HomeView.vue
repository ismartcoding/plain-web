<template>
  <div class="grids">
    <FeatureCard to="/audios" :title="$t('audios')" :count="counter.audios">
      <template #icon><i-lucide:music /></template>
    </FeatureCard>

    <FeatureCard to="/images" :title="$t('images')" :count="counter.images">
      <template #icon><i-lucide:image /></template>
    </FeatureCard>

    <FeatureCard to="/videos" :title="$t('videos')" :count="counter.videos">
      <template #icon><i-lucide:video /></template>
    </FeatureCard>

    <FeatureCard to="/docs" :title="$t('page_title.docs')" :count="counter.docs">
      <template #icon><i-lucide:file-text /></template>
    </FeatureCard>

    <FeatureCard :to="filesPath" :title="$t('files')">
      <template #icon><i-lucide:folder /></template>
      <div v-if="counter.total >= 0" class="storage-info">
        {{ $t('storage_free_total', { free: formatFileSize(counter.free), total: formatFileSize(counter.total) }) }}
      </div>
    </FeatureCard>

    <FeatureCard v-if="app.channel !== 'GOOGLE'" to="/apps" :title="$t('apps')" :count="counter.packages">
      <template #icon><i-lucide:layout-grid /></template>
    </FeatureCard>

    <FeatureCard to="/notes" :title="$t('page_title.notes')" :count="counter.notes">
      <template #icon><i-lucide:notebook-pen /></template>
    </FeatureCard>

    <FeatureCard to="/feeds" :title="$t('page_title.feeds')" :count="counter.feedEntries">
      <template #icon><i-lucide:rss /></template>
    </FeatureCard>

    <FeatureCard v-if="app.channel !== 'GOOGLE'" to="/messages" :title="$t('messages')" :count="counter.messages">
      <template #icon><i-lucide:message-square-text /></template>
    </FeatureCard>

    <FeatureCard v-if="app.channel !== 'GOOGLE'" to="/calls" :title="$t('calls')" :count="counter.calls">
      <template #icon><i-material-symbols:call-log-outline-rounded /></template>
    </FeatureCard>

    <FeatureCard to="/contacts" :title="$t('contacts')" :count="counter.contacts">
      <template #icon><i-lucide:contact-round /></template>
    </FeatureCard>

    <FeatureCard to="/screen-mirror" :title="$t('screen_mirror')">
      <template #icon><i-material-symbols:screen-record-rounded /></template>
    </FeatureCard>

    <FeatureCard to="/device-info" :title="$t('device_info')">
      <template #icon><i-lucide:smartphone /></template>
    </FeatureCard>

    <div class="card phone-card">
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

    <CallPhoneCard />
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
</script>

<style lang="scss" scoped>
.grids {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
  overflow-y: auto;
  padding: 16px;
}

:deep(.feature-card) {
  cursor: pointer;
  text-decoration: none;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
  min-height: 120px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .card-icon {
    display: flex;
    justify-content: center;
    align-items: center;
    margin-bottom: 8px;

    svg {
      width: 32px;
      height: 32px;
      color: var(--md-sys-color-primary);
    }
  }

  .card-content {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;

    .card-title-row {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 6px;
      margin: 0;

      .count {
        font-size: 1.25rem;
        font-weight: 700;
        color: var(--md-sys-color-primary);
      }

      .title {
        font-size: 0.875rem;
        text-transform: capitalize;
        color: var(--md-sys-color-on-surface);
      }
    }

    .storage-info {
      font-size: 0.75rem;
      color: var(--md-sys-color-on-surface-variant);
      margin-top: 4px;
    }
  }
}

.phone-card {
  grid-column: span 2;
  min-height: 144px;

  .card-content {
    text-align: left;

    .card-title {
      font-size: 1rem;
      font-weight: 500;
      margin: 0 0 16px 0;
      text-transform: none;
      color: var(--md-sys-color-on-surface);
    }

    .phone-input-row {
      display: flex;
      gap: 12px;
      align-items: flex-start;

      .phone-input {
        flex: 1;
        min-width: 0;
      }

      .call-btn {
        margin-top: 8px;
        min-width: 80px;
      }
    }
  }
}

@media (max-width: 768px) {
  .grids {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 12px;
    padding: 12px;
    margin-block-end: 24px;
  }

  .phone-card {
    grid-column: span 2;
  }
}
</style>
