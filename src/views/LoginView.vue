<template>
  <div class="header">
    <header-actions :logged-in="false" />
  </div>
  <div class="logo">
    <div>{{ $t('app_name') }}</div>
  </div>
  <div class="login-block">
    <form @submit.prevent="onSubmit" v-show="!showConfirm">
      <div class="alert alert-danger" role="alert" v-show="showError">
        {{ error ? $t(error) : '' }}
      </div>
      <input v-if="showPasswordInput" type="password" class="form-control" v-model="password" :placeholder="t('password')" />
      <div class="invalid-feedback" v-show="passwordError">
        {{ passwordError ? $t(passwordError) : '' }}
      </div>
      <div class="d-grid mt-4">
        <button class="btn" type="submit" :disabled="isSubmitting">
          {{ $t(isSubmitting ? 'logging_in' : 'log_in') }}
        </button>
      </div>
    </form>
    <div v-show="showConfirm">
      {{ $t('login.to_continue') }}
      <div class="d-grid mt-4">
        <button @click="cancel" class="btn" type="button">
          {{ $t('cancel') }}
        </button>
      </div>
    </div>
  </div>
  <div class="tips" v-if="showWarning">{{ $t('browser_warning') }}</div>
</template>
<script setup lang="ts">
import { ref } from 'vue'
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
      router.push({ path: router.currentRoute.value.query['redirect']?.toString() ?? '/', replace: true })
    }
  }
  ws.onclose = (event: CloseEvent) => {
    if (event.reason === 'abort' || event.reason === 'OK') {
      return
    }
    isSubmitting.value = false
    showError.value = true
    showConfirm.value = false
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

.logo {
  margin-top: 100px;
  padding-bottom: 16px;
  text-align: center;
}

.login-block {
  width: 360px;
  margin: 0 auto;
  border-radius: var(--border-radius);
  border: 1px solid var(--border-color);
  padding: 20px;
}

.tips {
  text-align: center;
  padding: 16px;
  width: 320px;
  margin: 0 auto;
}
</style>
