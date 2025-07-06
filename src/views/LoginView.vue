<template>
  <header class="header">
    <header-actions :logged-in="false" />
  </header>
  <h1>{{ $t('app_name') }}</h1>
  <div class="login-block">
    <form v-show="!showConfirm" @submit.prevent="onSubmit">
      <div v-show="showError" class="alert alert-danger show" role="alert">
        <i-material-symbols:error-outline-rounded />
        <div class="body">
          {{ error ? $t(error) : '' }}
        </div>
      </div>
      <v-text-field
        v-if="showPasswordInput"
        v-model="password"
        :label="t('password')"
        type="password"
        class="form-control"
        :error="passwordError"
        autocomplete="current-password"
        :error-text="passwordError ? $t(passwordError) : ''"
        @keydown.enter="onSubmit"
      />
      <v-filled-button v-if="!webAccessDisabled" :disabled="isSubmitting" :loading="isSubmitting">
        {{ $t(isSubmitting ? 'logging_in' : 'log_in') }}
      </v-filled-button>
    </form>
    <div v-show="showConfirm">
      <div class="tap-phone">
        <TouchPhone />
      </div>
      <div class="tap-phone-text">
        {{ $t('login.to_continue') }}
      </div>
      <v-outlined-button @click="cancel">
        {{ $t('cancel') }}
      </v-outlined-button>
    </div>
  </div>
  <div v-if="showWarning" class="tips">{{ $t('browser_warning') }}</div>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import TouchPhone from '@/assets/touch-phone.svg'
import { useField, useForm } from 'vee-validate'
import { string } from 'yup'
import { useI18n } from 'vue-i18n'
import router from '@/plugins/router'
import { sha512, hashToKey, chachaEncrypt, chachaDecrypt, bitArrayToUint8Array } from '@/lib/api/crypto'
import { getApiBaseUrl, getApiHeaders, getWebSocketBaseUrl } from '@/lib/api/api'
import { getAccurateAgent } from '@/lib/agent/agent'
import { arrayBuffertoBits } from '@/lib/api/sjcl-arraybuffer'
const { handleSubmit, isSubmitting } = useForm()
const showError = ref(false)
const webAccessDisabled = ref(true)
const showConfirm = ref(false)
const error = ref('')
let ws: WebSocket
const showWarning = window.location.protocol === 'http:' ? false : !(window.navigator as any).userAgentData
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
  const pass = (password.value as string) ?? ''
  const hash = sha512(pass)
  const key = hashToKey(hash)
  error.value = ''
  showError.value = false
  ws.onopen = async () => {
    isSubmitting.value = true
    const ua = await getAccurateAgent()
    const enc = chachaEncrypt(
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
    const d = chachaDecrypt(key, arrayBuffertoBits(await event.data.arrayBuffer()))
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

<style lang="scss" scoped>
.header {
  display: flex;
  justify-content: end;
  margin-top: 6px;
}

.v-filled-button,
.v-outlined-button {
  margin-top: 24px;
  width: 100%;
}

h1 {
  margin-top: 100px;
  text-align: center;
}

.login-block {
  width: 280px;
  margin: 0 auto;
  --outlined-field-bg: var(--md-sys-color-surface-variant);
  background-color: var(--md-sys-color-surface-variant);
  border-radius: var(--pl-shape-xl);
  padding-block: var(--pl-spacing-xl);
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
  .tap-phone-text {
    text-align: center;
  }
}

.tips {
  text-align: center;
  padding: 16px;
  width: 320px;
  margin: 0 auto;
}

.alert-danger {
  margin-block-end: 16px;
}
</style>
