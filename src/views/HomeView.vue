<template>
  <div class="grids">
    <div class="card feature-card" @click="openTab('/audios')">
      <div class="card-icon">
        <i-lucide:music />
      </div>
      <div class="card-content">
        <div class="card-title-row">
          <span v-if="counter.audios !== undefined && counter.audios >= 0" class="count">{{ counter.audios.toLocaleString() }}</span>
          <span class="title">{{ $t('audios') }}</span>
        </div>
      </div>
    </div>
    <div class="card feature-card" @click="openTab('/images')">
      <div class="card-icon">
        <i-lucide:image />
      </div>
      <div class="card-content">
        <div class="card-title-row">
          <span v-if="counter.images !== undefined && counter.images >= 0" class="count">{{ counter.images.toLocaleString() }}</span>
          <span class="title">{{ $t('images') }}</span>
        </div>
      </div>
    </div>
    <div class="card feature-card" @click="openTab('/videos')">
      <div class="card-icon">
        <i-lucide:video />
      </div>
      <div class="card-content">
        <div class="card-title-row">
          <span v-if="counter.videos !== undefined && counter.videos >= 0" class="count">{{ counter.videos.toLocaleString() }}</span>
          <span class="title">{{ $t('videos') }}</span>
        </div>
      </div>
    </div>

    <div class="card feature-card" @click="openFilesInternalStorage">
      <div class="card-icon">
        <i-lucide:folder />
      </div>
      <div class="card-content">
        <div class="card-title-row">
          <span class="title">{{ $t('files') }}</span>
        </div>
        <div v-if="counter.total >= 0" class="storage-info">
          {{ $t('storage_free_total', { free: formatFileSize(counter.free), total: formatFileSize(counter.total) }) }}
        </div>
      </div>
    </div>

    <div v-if="app.channel !== 'GOOGLE'" class="card feature-card" @click="openTab('/apps')">
      <div class="card-icon">
        <i-lucide:layout-grid />
      </div>
      <div class="card-content">
        <div class="card-title-row">
          <span v-if="counter.packages !== undefined && counter.packages >= 0" class="count">{{ counter.packages.toLocaleString() }}</span>
          <span class="title">{{ $t('apps') }}</span>
        </div>
      </div>
    </div>

    <div class="card feature-card" @click="openTab('/notes')">
      <div class="card-icon">
        <i-lucide:notebook-pen />
      </div>
      <div class="card-content">
        <div class="card-title-row">
          <span v-if="counter.notes !== undefined && counter.notes >= 0" class="count">{{ counter.notes.toLocaleString() }}</span>
          <span class="title">{{ $t('page_title.notes') }}</span>
        </div>
      </div>
    </div>

    <div class="card feature-card" @click="openTab('/feeds')">
      <div class="card-icon">
        <i-lucide:rss />
      </div>
      <div class="card-content">
        <div class="card-title-row">
          <span v-if="counter.feedEntries !== undefined && counter.feedEntries >= 0" class="count">{{ counter.feedEntries.toLocaleString() }}</span>
          <span class="title">{{ $t('page_title.feeds') }}</span>
        </div>
      </div>
    </div>

    <div v-if="app.channel !== 'GOOGLE'" class="card feature-card" @click="openTab('/messages')">
      <div class="card-icon">
        <i-lucide:message-square-text />
      </div>
      <div class="card-content">
        <div class="card-title-row">
          <span v-if="counter.messages !== undefined && counter.messages >= 0" class="count">{{ counter.messages.toLocaleString() }}</span>
          <span class="title">{{ $t('messages') }}</span>
        </div>
      </div>
    </div>

    <div v-if="app.channel !== 'GOOGLE'" class="card feature-card" @click="openTab('/calls')">
      <div class="card-icon">
        <i-material-symbols:call-log-outline-rounded />
      </div>
      <div class="card-content">
        <div class="card-title-row">
          <span v-if="counter.calls !== undefined && counter.calls >= 0" class="count">{{ counter.calls.toLocaleString() }}</span>
          <span class="title">{{ $t('calls') }}</span>
        </div>
      </div>
    </div>

    <div class="card feature-card" @click="openTab('/contacts')">
      <div class="card-icon">
        <i-lucide:contact-round />
      </div>
      <div class="card-content">
        <div class="card-title-row">
          <span v-if="counter.contacts !== undefined && counter.contacts >= 0" class="count">{{ counter.contacts.toLocaleString() }}</span>
          <span class="title">{{ $t('contacts') }}</span>
        </div>
      </div>
    </div>

    <!-- Tools Section Cards -->
    <div class="card feature-card" @click="openTab('/screen-mirror')">
      <div class="card-icon">
        <i-material-symbols:screen-record-rounded />
      </div>
      <div class="card-content">
        <div class="card-title-row">
          <span class="title">{{ $t('screen_mirror') }}</span>
        </div>
      </div>
    </div>

    <div class="card feature-card" @click="openTab('/device-info')">
      <div class="card-icon">
        <i-lucide:smartphone />
      </div>
      <div class="card-content">
        <div class="card-title-row">
          <span class="title">{{ $t('device_info') }}</span>
        </div>
      </div>
    </div>

    <!-- Phone Call Card -->
    <div class="card phone-card">
      <div class="card-content">
        <h5 class="card-title">{{ $t('call_phone') }}</h5>
        <div class="phone-input-row">
          <v-text-field v-model="callNumber" type="tel" :label="$t('phone_number')" class="phone-input" :error="callNumberError" :error-text="$t('valid.required')" @keyup.enter="callPhone">
            <template #trailing-icon>
              <v-icon-button @click.prevent="pastePhoneNumber">
                <i-material-symbols:content-paste-rounded />
              </v-icon-button>
            </template>
          </v-text-field>
          <v-filled-button class="call-btn" :disabled="callLoading" @click.prevent="callPhone">
            {{ $t('call') }}
          </v-filled-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import toast from '@/components/toaster'
import { homeStatsGQL, initQuery } from '@/lib/api/query'
import { formatFileSize } from '@/lib/format'
import { inject, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTempStore } from '@/stores/temp'
import { storeToRefs } from 'pinia'
import { sumBy } from 'lodash-es'
import { useMainStore } from '@/stores/main'
import { callGQL, initMutation } from '@/lib/api/mutation'
import { replacePath } from '@/plugins/router'
import type { IHomeStats, IStorageMount } from '@/lib/interfaces'
import { buildQuery } from '@/lib/search'
import { encodeBase64 } from '@/lib/strutil'

const isPhone = inject('isPhone') as boolean
const { t } = useI18n()

const mainStore = useMainStore()

const { callNumber } = storeToRefs(mainStore)
const callNumberError = ref(false)

const { app, counter } = storeToRefs(useTempStore())

const mounts = ref<IStorageMount[]>([])

function openTab(fullPath: string) {
  replacePath(mainStore, fullPath)
}

function openFilesInternalStorage() {
  const internalRoot =
    mounts.value.find((m) => m.driveType === 'INTERNAL_STORAGE')?.mountPoint || app.value.internalStoragePath

  const q = buildQuery([
    {
      name: 'parent',
      op: '',
      value: internalRoot,
    },
    {
      name: 'type',
      op: '',
      value: 'INTERNAL_STORAGE',
    },
    {
      name: 'root_path',
      op: '',
      value: internalRoot,
    },
  ])
  replacePath(mainStore, `/files?q=${encodeBase64(q)}`)
}

function pastePhoneNumber() {
  navigator.clipboard.readText().then((text) => {
    callNumber.value = text
  })
}

const { mutate: mutateCall, loading: callLoading } = initMutation({
  document: callGQL,
})

const callPhone = () => {
  if (!callNumber.value) {
    callNumberError.value = true
    return
  }
  mutateCall({ number: callNumber.value })
}

watch(callNumber, () => {
  callNumberError.value = false
})

initQuery({
  handle: (data: IHomeStats, error: string) => {
    if (error) {
      toast(t(error), 'error')
    } else {
      if (data) {
        mounts.value = data.mounts ?? []

        counter.value.messages = data.messageCount
        counter.value.contacts = data.contactCount
        counter.value.calls = data.callCount
        counter.value.videos = data.videoCount
        counter.value.images = data.imageCount
        counter.value.audios = data.audioCount
        counter.value.packages = data.packageCount
        counter.value.notes = data.noteCount
        counter.value.feedEntries = data.feedEntryCount

        const vols = (data.mounts ?? []).filter((m) => (m.totalBytes ?? 0) > 0)
        counter.value.total = sumBy(vols, (it) => it.totalBytes ?? 0)
        counter.value.free = sumBy(vols, (it) => it.freeBytes ?? 0)
      }
    }
  },
  document: homeStatsGQL,
  variables: null,
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

.feature-card {
  cursor: pointer;
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

    .count {
      font-size: 0.875rem;
      color: var(--md-sys-color-on-surface-variant);
    }
  }
}

.phone-card {
  grid-column: span 2;
  min-height: 144px;
  .card-title {
    text-align: left;
  }
  .card-icon {
    display: flex;
    justify-content: center;
    align-items: center;
    margin-bottom: 12px;

    svg {
      width: 32px;
      height: 32px;
      color: var(--md-sys-color-primary);
    }
  }

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
