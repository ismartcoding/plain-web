<template>
  <div class="page-container">
    <div class="main">
      <h2>
        {{ $t('storage')
        }}<span style="font-size: 0.875rem; font-weight: normal; margin-left: 8px" v-if="totalBytes >= 0">{{
          $t('storage_free_total', { free: formatFileSize(freeBytes), total: formatFileSize(totalBytes) })
        }}</span>
      </h2>
      <p class="stats-items">
        <a href="#" @click.prevent="openTab('/images')"> {{ $t('images') }}</a>
        <a href="#" @click.prevent="openTab('/audios')"> {{ $t('audios') }}</a>
        <a href="#" @click.prevent="openTab('/videos')">{{ $t('videos') }}</a>
        <a href="#" @click.prevent="openTab('/files')">{{ $t('files') }} </a>
        <a href="#" @click.prevent="openTab('/apps')" v-if="app.allowSensitivePermissions">{{ $t('apps') }}</a>
      </p>
      <h2>{{ $t('work') }}</h2>
      <p class="stats-items">
        <a href="#" @click.prevent="openTab('/notes')">{{ $t('page_title.notes') }}</a>
        <a style="display: none" href="#" @click.prevent="openTab('/books')">{{ $t('page_title.books') }}</a>
        <a href="#" @click.prevent="openTab('/feeds')">{{ $t('page_title.feeds') }}</a>
        <a href="#" @click.prevent="openTab('/aichats')">{{ $t('page_title.aichats') }}</a>
      </p>
      <h2>{{ $t('social') }}</h2>
      <p class="stats-items">
        <a href="#" @click.prevent="openTab('/messages')" v-if="app.allowSensitivePermissions"
          >{{ $t('messages') }}<template v-if="messageCount >= 0">({{ messageCount }})</template></a
        >
        <a href="#" @click.prevent="openTab('/contacts')"
          >{{ $t('contacts') }}<template v-if="contactCount >= 0">({{ contactCount }})</template></a
        >
        <a href="#" @click.prevent="openTab('/calls')" v-if="app.allowSensitivePermissions"
          >{{ $t('calls') }}<template v-if="callCount >= 0">({{ callCount }})</template></a
        >
      </p>
      <h2>{{ $t('tools') }}</h2>
      <p class="stats-items">
        <a href="#" @click.prevent="openTab('/json-viewer')">{{ $t('json_viewer') }}</a>
        <a href="#" @click.prevent="openTab('/qrcode-generator')">{{ $t('qrcode_generator') }}</a>
        <a href="#" @click.prevent="openTab('/screen-mirror')">{{ $t('screen_mirror') }}</a>
        <a href="#" @click.prevent="openTab('/device-info')">{{ $t('device_info') }}</a>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import toast from '@/components/toaster'
import { homeStatsGQL, initQuery } from '@/lib/api/query'
import { replacePath } from '@/plugins/router'
import { formatFileSize } from '@/lib/format'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTempStore } from '@/stores/temp'
import { storeToRefs } from 'pinia'
import { sumBy } from 'lodash-es'
import type { IStorageStatsItem } from '@/lib/interfaces'
import { useMainStore } from '@/stores/main'
const { t } = useI18n()

const mainStore = useMainStore()

const { app } = storeToRefs(useTempStore())
const messageCount = ref(-1)
const contactCount = ref(-1)
const callCount = ref(-1)
const totalBytes = ref(-1)
const freeBytes = ref(-1)

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
  margin: 40px 0;
  font-size: 1.2rem;

  a + a {
    margin-left: 24px;
  }
}
</style>
