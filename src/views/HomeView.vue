<template>
  <div class="page-container">
    <div class="main">
      <div class="grid">
        <div class="g-col-lg-6 g-col-md-12">
          <section class="card">
            <div class="card-body">
              <h5 class="card-title">
                {{ $t('storage')
                }}<span class="total-bytes" v-if="totalBytes >= 0">{{ $t('storage_free_total', { free: formatFileSize(freeBytes), total: formatFileSize(totalBytes) }) }}</span>
              </h5>
              <p class="stats-items">
                <a href="#" @click.prevent="openTab('/images')"> {{ $t('images') }}</a>
                <a href="#" @click.prevent="openTab('/audios')"> {{ $t('audios') }}</a>
                <a href="#" @click.prevent="openTab('/videos')">{{ $t('videos') }}</a>
                <a href="#" @click.prevent="openTab('/files')">{{ $t('files') }} </a>
                <a href="#" @click.prevent="openTab('/apps')">{{ $t('apps') }}</a>
              </p>
            </div>
          </section>
        </div>
        <div class="g-col-lg-6 g-col-md-12">
          <section class="card">
            <div class="card-body">
              <h5 class="card-title">{{ $t('work') }}</h5>
              <p class="stats-items">
                <a href="#" @click.prevent="openTab('/notes')">{{ $t('page_title.notes') }}</a>
                <a style="display: none" href="#" @click.prevent="openTab('/books')">{{ $t('page_title.books') }}</a>
                <a href="#" @click.prevent="openTab('/feeds')">{{ $t('page_title.feeds') }}</a>
                <!-- <a href="#" @click.prevent="openTab('/aichats')">{{ $t('page_title.aichats') }}</a> -->
              </p>
            </div>
          </section>
        </div>
        <div class="g-col-lg-6 g-col-md-12">
          <section class="card">
            <div class="card-body">
              <h5 class="card-title">{{ $t('social') }}</h5>
              <p class="stats-items">
                <a href="#" @click.prevent="openTab('/messages')" v-if="app.channel !== 'GOOGLE'">{{ $t('messages') }}<template v-if="messageCount >= 0">({{ messageCount }})</template></a>
                <a href="#" @click.prevent="openTab('/calls')" v-if="app.channel !== 'GOOGLE'">{{ $t('calls') }}<template v-if="callCount >= 0">({{ callCount }})</template></a>
                <a href="#" @click.prevent="openTab('/contacts')" >{{ $t('contacts') }}<template v-if="contactCount >= 0">({{ contactCount }})</template></a>
              </p>
            </div>
          </section>
        </div>
        <div class="g-col-lg-6 g-col-md-12">
          <section class="card">
            <div class="card-body">
              <h5 class="card-title">{{ $t('tools') }}</h5>
              <p class="stats-items">
                <a href="#" @click.prevent="openTab('/screen-mirror')">{{ $t('screen_mirror') }}</a>
                <a href="#" @click.prevent="openTab('/device-info')">{{ $t('device_info') }}</a>
                <a href="#" @click.prevent="openTab('/qrcode-generator')">{{ $t('qrcode_generator') }}</a>
                <a href="#" @click.prevent="openTab('/json-viewer')">{{ $t('json_viewer') }}</a>
              </p>
            </div>
          </section>
        </div>
        <div class="g-col-lg-6 g-col-md-12">
          <section class="card">
            <div class="card-body">
              <h5 class="card-title">{{ $t('call_phone') }}</h5>
              <p class="form-row">
                <md-outlined-text-field
                  type="tel"
                  :label="$t('phone_number')"
                  class="form-control flex-3"
                  v-model="callNumber"
                  :error="callNumberError"
                  :error-text="$t('valid.required')"
                >
                  <button class="icon-button" slot="trailing-icon" @click.prevent="pastePhoneNumber">
                    <md-ripple />
                    <i-material-symbols:content-paste-rounded />
                  </button>
                </md-outlined-text-field>
                <md-filled-button class="btn-lg" @click.prevent="callPhone" :disabled="callLoading">
                  {{ $t('call') }}
                </md-filled-button>
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import toast from '@/components/toaster'
import { homeStatsGQL, initQuery } from '@/lib/api/query'
import { replacePath } from '@/plugins/router'
import { formatFileSize } from '@/lib/format'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTempStore } from '@/stores/temp'
import { storeToRefs } from 'pinia'
import { sumBy } from 'lodash-es'
import type { IStorageStatsItem } from '@/lib/interfaces'
import { useMainStore } from '@/stores/main'
import { useForm } from 'vee-validate'
import { callGQL, initMutation } from '@/lib/api/mutation'
const { t } = useI18n()
const { handleSubmit } = useForm()

const mainStore = useMainStore()

const { callNumber } = storeToRefs(mainStore)
const callNumberError = ref(false)

const { app } = storeToRefs(useTempStore())
const messageCount = ref(-1)
const contactCount = ref(-1)
const callCount = ref(-1)
const totalBytes = ref(-1)
const freeBytes = ref(-1)

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
        messageCount.value = data.messageCount
        contactCount.value = data.contactCount
        callCount.value = data.callCount
        totalBytes.value = data.storageStats.internal.totalBytes
        freeBytes.value = data.storageStats.internal.freeBytes
        const sdcard = data.storageStats.sdcard
        if (sdcard) {
          totalBytes.value += sdcard.totalBytes
          freeBytes.value += sdcard.freeBytes
        }
        const usb = data.storageStats.usb
        if (usb.length) {
          totalBytes.value += sumBy(usb, (it: IStorageStatsItem) => it.totalBytes)
          freeBytes.value += sumBy(usb, (it: IStorageStatsItem) => it.freeBytes)
        }
      }
    }
  },
  document: homeStatsGQL,
  variables: null,
  appApi: true,
})

function openTab(fullPath: string) {
  replacePath(mainStore, fullPath)
}
</script>

<style lang="scss" scoped>
.stats-items {
  a + a {
    margin-left: 1rem;
  }
}

.total-bytes {
  font-size: 0.875rem;
  font-weight: normal;
  margin-left: 8px;
}
</style>
