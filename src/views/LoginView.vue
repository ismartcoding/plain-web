<template>
  <header class="header">
    <header-actions :logged-in="false" />
  </header>
  <h1>{{ $t('app_name') }}</h1>
  <div class="login-block">
    <form @submit.prevent="onSubmit" v-show="!showConfirm">
      <div class="alert alert-danger" role="alert" v-show="showError">
        {{ error ? $t(error) : '' }}
      </div>
      <md-outlined-text-field v-if="showPasswordInput" :label="t('password')" v-model="password" @keydown.enter="onSubmit"
        type="password" class="form-control" :error="passwordError"
        :error-text="passwordError ? $t(passwordError) : ''" />
      <md-filled-button v-if="!webAccessDisabled" :disabled="isSubmitting">
        {{ $t(isSubmitting ? 'logging_in' : 'log_in') }}
      </md-filled-button>
    </form>
    <div v-show="showConfirm">
      <div class="tap-phone">
        <TouchPhone />
      </div>
      {{ $t('login.to_continue') }}
      <md-outlined-button @click="cancel">
        {{ $t('cancel') }}
      </md-outlined-button>
    </div>
  </div>
  <div class="tips" v-if="showWarning">{{ $t('browser_warning') }}</div>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import TouchPhone from '@/assets/touch-phone.svg'
import { useField, useForm } from 'vee-validate'
import { string } from 'yup'
import { useI18n } from 'vue-i18n'
import router from '@/plugins/router'
import { sha512, hashToKey, aesEncrypt, aesDecrypt, bitArrayToUint8Array } from '@/lib/api/crypto'
import { getApiBaseUrl, getApiHeaders, getWebSocketBaseUrl } from '@/lib/api/api'
import { getAccurateAgent } from '@/lib/agent/agent'
import { arrayBuffertoBits } from '@/lib/api/sjcl-arraybuffer'
const { handleSubmit, isSubmitting } = useForm()
const showError = ref(false)
const webAccessDisabled = ref(true)
const showConfirm = ref(false)
const error = ref('')
let ws: WebSocket
const showWarning = window.location.protocol === 'http:' ? false : !window.navigator.userAgentData
const { t } = useI18n()
const { value: password, errorMessage: passwordError } = useField('password', string().required())
const showPasswordInput = ref(false)

async function initRequest() {
  const r = await fetch(`${getApiBaseUrl()}/init`, {
    method: 'POST',
    headers: getApiHeaders(),
  })
  if (r.status === 403) {
    showError.value = true
    webAccessDisabled.value = true
    error.value = 'web_access_disabled'
    return
  }
  webAccessDisabled.value = false
  const pwd = await r.text()
  if (pwd) {
    password.value = pwd
    showPasswordInput.value = false
  } else {
    showPasswordInput.value = true
  }
}

initRequest()

const onSubmit = handleSubmit(async () => {
  const clientId = localStorage.getItem('client_id')
  ws = new WebSocket(`${getWebSocketBaseUrl()}?cid=${clientId}&auth=1`)
  const pass = password.value ?? ''
  const hash = sha512(pass)
  const key = hashToKey(hash)
  error.value = ''
  showError.value = false
  ws.onopen = async () => {
    isSubmitting.value = true
    const ua = await getAccurateAgent()
    const enc = aesEncrypt(
      key,
      JSON.stringify({
        password: hash,
        browserName: ua.browser.name,
        browserVersion: ua.browser.version,
        osName: ua.os.name,
        osVersion: ua.os.version,
        isMobile: ua.isMobile,
      })
    )
    ws.send(bitArrayToUint8Array(enc))
  }
  ws.onmessage = async (event: MessageEvent) => {
    const d = aesDecrypt(key, arrayBuffertoBits(await event.data.arrayBuffer()))
    const r = JSON.parse(d)
    if (r.status === 'PENDING') {
      showConfirm.value = true
    } else {
      localStorage.setItem('auth_token', r.token)
      ws.close()
      window.location.href = router.currentRoute.value.query['redirect']?.toString() ?? '/'
    }
  }
  ws.onclose = async (event: CloseEvent) => {
    if (event.reason === 'abort' || event.reason === 'OK') {
      return
    }
    isSubmitting.value = false
    showError.value = true
    showConfirm.value = false
    if (!event.reason) {
      const r = await fetch(`${getApiBaseUrl()}/health_check`)
      if (r.status === 200) {
        error.value = 'failed_connect_ws'
        return
      }
    }
    error.value = `login.${event.reason ? event.reason : 'failed'}`
  }

  window.setTimeout(function () {
    if (ws.readyState !== 1) {
      ws.close(3001, 'timeout')
    }
  }, 2000)
})

function cancel() {
  showConfirm.value = false
  showError.value = false
  isSubmitting.value = false
  ws.close(3001, 'abort')
}
</script>

<style scoped>
.header {
  display: flex;
  justify-content: end;
  margin-top: 6px;
  padding-right: 16px;
}

md-filled-button,
md-outlined-button {
  display: block;
  margin-top: 24px;
}

h1 {
  margin-top: 100px;
  text-align: center;
}

.login-block {
  width: 280px;
  margin: 0 auto;
  background-color: var(--md-sys-color-surface-variant);
  border-radius: var(--plain-shape-xl);
  padding-block: var(--plain-spacing-xl);
  padding: 40px;

  .tap-phone {
    text-align: center;
    padding-block-end: 1rem;

    *:is(svg) {
      width: 120px;
      margin-inline-start: 24px;
      fill: var(--md-sys-color-primary);
    }
  }
}

.tips {
  text-align: center;
  padding: 16px;
  width: 320px;
  margin: 0 auto;
}

.alert-danger {
  margin-block-end: 32px;
}
</style>
