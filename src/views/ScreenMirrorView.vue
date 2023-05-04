<template>
  <div class="page-container container">
    <div class="main">
      <div class="v-toolbar">
        <breadcrumb :current="() => $t('screen_mirror')" />
        <div class="right-actions">
          <button v-if="url" type="button" class="btn btn-action" :disabled="stopServiceLoading" @click="stopService">
            {{ $t('stop_mirror') }}
          </button>
        </div>
      </div>
      <div class="panel-container">
        <div v-if="fetchImageLoading || startServiceLoading" class="loading">
          <div class="loader"></div>
        </div>
        <div v-if="seconds > 0" class="request-permission">
          <img src="@/assets/screen-mirror-permission.png" />
          <div class="text" v-html="$t('screen_mirror_request_permission', { seconds: seconds })">
          </div>
        </div>
        <div v-if="failed && !url" class="request-permission-failed">
          <MobileWarning />
          {{ $t('screen_mirror_request_permission_failed') }}
          <button class="btn" @click="start">{{ $t('try_again') }}</button>
        </div>
        <img v-if="url" :src="url" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import emitter from '@/plugins/eventbus';
import toast from '@/components/toaster'
import { onMounted, ref } from 'vue'
import MobileWarning from '@/assets/mobile-warning.svg'
import { initQuery, screenMirrorImageGQL } from '@/lib/api/query';
import { useI18n } from 'vue-i18n';
import { initMutation, startScreenMirrorGQL, stopScreenMirrorGQL } from '@/lib/api/mutation';
import type { ApolloError } from '@apollo/client/errors';

let countIntervalId: number
const { t } = useI18n()
const url = ref('')
const seconds = ref(0)
const failed = ref(false)
onMounted(() => {
  emitter.on('screen_mirrorring', async (data: string) => {
    url.value = data
    failed.value = false
    seconds.value = 0
    clearInterval(countIntervalId)
  })
})

const {
  mutate: startService,
  loading: startServiceLoading,
  onDone: startServiceDone,
  onError: startServiceError,
} = initMutation({
  document: startScreenMirrorGQL,
  appApi: true,
})

const { loading: fetchImageLoading, refetch } = initQuery({
  handle: (data: any, error: string) => {
    if (error) {
      toast(t(error), 'error')
    } else {
      if (data.screenMirrorImage) {
        url.value = data.screenMirrorImage
      } else {
        start()
      }
    }
  },
  document: screenMirrorImageGQL,
  appApi: true,
})

const start = () => {
  failed.value = false
  startService()
}

startServiceError((error: ApolloError) => {
  toast(t(error.message))
  failed.value = true
})

startServiceDone(() => {
  seconds.value = 30
  countIntervalId = setInterval(() => {
    seconds.value--
    if (seconds.value <= 0) {
      failed.value = true
      clearInterval(countIntervalId)
    }
  }, 1000)
})

const {
  mutate: stopService,
  loading: stopServiceLoading,
  onDone: stopServiceDone,
  onError: stopServiceError,
} = initMutation({
  document: stopScreenMirrorGQL,
  appApi: true,
})

stopServiceError((error: ApolloError) => {
  toast(t(error.message))
})

stopServiceDone(() => {
  failed.value = true
  url.value = ''
})
</script>
<style lang="scss" scoped>
img {
  height: 100%;
  margin: 0 auto;
  display: block;
}

.panel-container {
  position: relative;
}

.request-permission {
  img {
    width: 320px;
    margin: 40px auto;
  }

  .text {
    text-align: center;
    font-size: 1.2rem;
    line-height: 2;
  }
}

.request-permission-failed {
  margin-top: 40px;
  text-align: center;
  font-size: 1.2rem;
  line-height: 2;

  svg {
    width: 160px;
    display: block;
    fill: var(--text-color);
    margin: 0 auto 40px auto;
  }

  .btn {
    margin: 40px auto;
  }
}
</style>
