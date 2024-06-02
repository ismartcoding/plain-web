<template>
  <div class="grids">
    <section class="card">
      <h5 class="card-title">
        <span>{{ $t('storage') }}</span>
        <span class="total-bytes" v-if="counter.total >= 0">{{ $t('storage_free_total', { free: formatFileSize(counter.free), total: formatFileSize(counter.total) }) }}</span>
      </h5>
      <div class="card-body">
        <feature-button name="images" :count="counter.images" path="/images">
          <template #icon>
            <i-material-symbols:image-outline-rounded />
          </template>
        </feature-button>
        <feature-button name="audios" :count="counter.audios" path="/audios">
          <template #icon>
            <i-material-symbols:audio-file-outline-rounded />
          </template>
        </feature-button>
        <feature-button name="videos" :count="counter.videos" path="/videos">
          <template #icon>
            <i-material-symbols:video-file-outline-rounded />
          </template>
        </feature-button>
        <feature-button v-if="app.channel !== 'GOOGLE'" name="apps" :count="counter.packages" path="/apps">
          <template #icon>
            <i-material-symbols:apps />
          </template>
        </feature-button>
        <feature-button name="files" path="/files">
          <template #icon>
            <i-material-symbols:file-present-outline-rounded />
          </template>
        </feature-button>
      </div>
    </section>
    <section class="card">
      <h5 class="card-title">{{ $t('work') }}</h5>
      <div class="card-body">
        <feature-button name="page_title.notes" :count="counter.notes" path="/notes">
          <template #icon>
            <i-material-symbols:notes-rounded />
          </template>
        </feature-button>
        <feature-button name="page_title.feeds" :count="counter.feedEntries" path="/feeds">
          <template #icon>
            <i-material-symbols:rss-feed-rounded />
          </template>
        </feature-button>
        <feature-button v-if="app.channel !== 'GOOGLE'" name="messages" :count="counter.messages" path="/messages">
          <template #icon>
            <i-material-symbols:sms-outline-rounded />
          </template>
        </feature-button>
        <feature-button v-if="app.channel !== 'GOOGLE'" name="calls" :count="counter.calls" path="/calls">
          <template #icon>
            <i-material-symbols:call-log-outline-rounded />
          </template>
        </feature-button>
        <feature-button name="contacts" :count="counter.contacts" path="/contacts">
          <template #icon>
            <i-material-symbols:contact-page-outline-rounded />
          </template>
        </feature-button>
      </div>
    </section>
    <section class="card">
      <h5 class="card-title">{{ $t('tools') }}</h5>
      <div class="card-body">
        <feature-button name="screen_mirror" path="/screen-mirror">
          <template #icon>
            <i-material-symbols:screen-record-rounded />
          </template>
        </feature-button>
        <feature-button name="device_info" path="/device-info">
          <template #icon>
            <i-material-symbols:perm-device-information-outline-rounded />
          </template>
        </feature-button>
        <feature-button name="qrcode_generator" path="/qrcode-generator">
          <template #icon>
            <i-material-symbols:qr-code-rounded />
          </template>
        </feature-button>
        <feature-button name="json_viewer" path="/json-viewer">
          <template #icon>
            <i-material-symbols:code-blocks-outline-rounded />
          </template>
        </feature-button>
      </div>
    </section>
    <section class="card">
      <h5 class="card-title">{{ $t('call_phone') }}</h5>
      <div class="card-body form-row">
        <md-outlined-text-field type="tel" :label="$t('phone_number')" class="form-control flex-3" v-model="callNumber" :error="callNumberError" :error-text="$t('valid.required')" @keyup.enter="callPhone">
          <button class="btn-icon" slot="trailing-icon" @click.prevent="pastePhoneNumber">
            <md-ripple />
            <i-material-symbols:content-paste-rounded />
          </button>
        </md-outlined-text-field>
        <md-filled-button class="btn-lg" @click.prevent="callPhone" :disabled="callLoading">
          {{ $t('call') }}
        </md-filled-button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import toast from '@/components/toaster'
import { homeStatsGQL, initQuery } from '@/lib/api/query'
import { formatFileSize } from '@/lib/format'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTempStore } from '@/stores/temp'
import { storeToRefs } from 'pinia'
import { sumBy } from 'lodash-es'
import type { IStorageStatsItem } from '@/lib/interfaces'
import { useMainStore } from '@/stores/main'
import { callGQL, initMutation } from '@/lib/api/mutation'
const { t } = useI18n()

const mainStore = useMainStore()

const { callNumber } = storeToRefs(mainStore)
const callNumberError = ref(false)

const { app, counter } = storeToRefs(useTempStore())

function pastePhoneNumber() {
  navigator.clipboard.readText().then((text) => {
    callNumber.value = text
  })
}

const { mutate: mutateCall, loading: callLoading } = initMutation({
  document: callGQL,
  appApi: true,
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
  handle: (data: any, error: string) => {
    if (error) {
      toast(t(error), 'error')
    } else {
      if (data) {
        counter.value.messages = data.messageCount
        counter.value.contacts = data.contactCount
        counter.value.calls = data.callCount
        counter.value.videos = data.videoCount
        counter.value.images = data.imageCount
        counter.value.audios = data.audioCount
        counter.value.packages = data.packageCount
        counter.value.notes = data.noteCount
        counter.value.feedEntries = data.feedEntryCount
        let totalBytes = data.storageStats.internal.totalBytes
        let freeBytes = data.storageStats.internal.freeBytes
        const sdcard = data.storageStats.sdcard
        if (sdcard) {
          totalBytes += sdcard.totalBytes
          freeBytes += sdcard.freeBytes
        }
        const usb = data.storageStats.usb
        if (usb.length) {
          totalBytes += sumBy(usb, (it: IStorageStatsItem) => it.totalBytes)
          freeBytes += sumBy(usb, (it: IStorageStatsItem) => it.freeBytes)
        }

        counter.value.total = totalBytes
        counter.value.free = freeBytes
      }
    }
  },
  document: homeStatsGQL,
  variables: null,
  appApi: true,
})
</script>

<style lang="scss" scoped>
.grids {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(564px, 1fr));
  gap: 16px;
  margin-block: 16px;
}
.card-title {
  .total-bytes {
    font-weight: normal;
    margin-inline-start: 8px;
    text-transform: none;
  }
}
.card-body {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.total-bytes {
  font-size: 0.875rem;
  font-weight: normal;
  margin-left: 8px;
}
.form-control {
  height: 56px;
}
.card-body.form-row {
  padding-block-start: 16px;
}
</style>
