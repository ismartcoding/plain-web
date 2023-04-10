<template>
  <div class="page-container container">
    <div class="main">
      <breadcrumb :current="() => $t('page_title.home')" />
      <div class="row">
        <div class="col-sm-6">
          <div class="card">
            <div class="card-body">
              <h5 class="card-title">{{ $t('social') }}</h5>
              <p class="card-text stats-items">
                <!-- <a href="#" @click.prevent="openTab('/messages')"
                  >{{ $t('messages') }}<template v-if="messageCount >= 0">({{ messageCount }})</template></a
                > -->
                <a href="#" @click.prevent="openTab('/contacts')"
                  >{{ $t('contacts') }}<template v-if="contactCount >= 0">({{ contactCount }})</template></a
                >
                <!-- <a href="#" @click.prevent="openTab('/calls')"
                  >{{ $t('calls') }}<template v-if="callCount >= 0">({{ callCount }})</template></a
                > -->
              </p>
            </div>
          </div>
        </div>
        <div class="col-sm-6">
          <div class="card">
            <div class="card-body">
              <h5 class="card-title">
                {{ $t('storage')
                }}<span style="font-size: 0.875rem; font-weight: normal; margin-left: 8px" v-if="totalBytes >= 0">{{
                  $t('storage_free_total', { free: formatFileSize(freeBytes), total: formatFileSize(totalBytes) })
                }}</span>
              </h5>
              <p class="card-text stats-items">
                <a href="#" @click.prevent="openTab('/files')">{{ $t('files') }} </a>
                <a href="#" @click.prevent="openTab('/images')"> {{ $t('images') }}</a>
                <a href="#" @click.prevent="openTab('/audios')"> {{ $t('audios') }}</a>
                <a href="#" @click.prevent="openTab('/videos')">{{ $t('videos') }}</a>
              </p>
            </div>
          </div>
        </div>
        <div class="col-sm-6 mt-4">
          <div class="card">
            <div class="card-body">
              <h5 class="card-title">{{ $t('tools') }}</h5>
              <p class="card-text stats-items">
                <a href="#" @click.prevent="openTab('/json-viewer')">{{ $t('json_viewer') }}</a>
                <a href="#" @click.prevent="openTab('/qrcode-generator')">{{ $t('qrcode_generator') }}</a>
              </p>
            </div>
          </div>
        </div>
        <div class="col-sm-6 mt-4">
          <div class="card">
            <div class="card-body">
              <h5 class="card-title">{{ $t('work') }}</h5>
              <p class="card-text stats-items">
                <a href="#" @click.prevent="openTab('/notes')">{{ $t('page_title.notes') }}</a>
                <a style="display: none" href="#" @click.prevent="openTab('/books')">{{ $t('page_title.books') }}</a>
                <a href="#" @click.prevent="openTab('/feeds')">{{ $t('page_title.feeds') }}</a>
                <a href="#" @click.prevent="openTab('/aichats')">{{ $t('page_title.aichats') }}</a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import toast from '@/components/toaster'
import { homeStatsGQL, initQuery } from '@/lib/api/query'
import router from '@/plugins/router'
import { formatFileSize } from '@/lib/format'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()

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
        totalBytes.value = data.storageStats.totalBytes
        freeBytes.value = data.storageStats.freeBytes
      }
    }
  },
  document: homeStatsGQL,
  variables: null,
  appApi: true,
})

function openTab(fullPath: string) {
  router.push(fullPath)
}
</script>

<style lang="scss" scoped>
.stats-items {
  a + a {
    margin-left: 24px;
  }
}
</style>
