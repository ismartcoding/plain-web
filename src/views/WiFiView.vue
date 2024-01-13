<template>
  <div class="page-container">
    <div class="main">
      <breadcrumb :current="() => $t('page_title.wifi')" />
      <edit-toolbar v-model="currentTab" :save="save" :loading="loading" :tabs="['t:basic', '/etc/hostapd/hostapd.conf']" />
      <form v-show="currentTab === 0">
        <div class="row mb-3">
          <label for="is-enabled" class="col-sm-3 col-md-2 col-form-label">{{ t('enable') }}</label>
          <div class="col-sm-4">
            <div class="form-check">
              <md-checkbox touch-target="wrapper" :checked="isEnabled" id="is-enabled" />
            </div>
          </div>
        </div>
        <div class="row mb-3">
          <label for="ssid" class="col-sm-3 col-md-2 col-form-label">{{ t('wifi.ssid') }}</label>
          <div class="col-sm-4">
            <input type="text" v-model="ssid" class="form-control" id="ssid" @change="updateConfig" />
            <div class="invalid-feedback" v-show="ssidError">
              {{ ssidError ? t(ssidError) : '' }}
            </div>
          </div>
        </div>
        <div class="row mb-3">
          <label for="password" class="col-sm-3 col-md-2 col-form-label">{{ t('password') }}</label>
          <div class="col-sm-4">
            <div class="input-group">
              <input class="form-control" v-model="password" id="password" @change="updateConfig" :type="showPassword ? 'text' : 'password'" />
              <a href="#" @click.prevent="toggleEye" class="input-group-text">
                <span class="inner">
                  <i-material-symbols:visibility-off-outline-rounded v-show="showPassword" />
                  <i-material-symbols:visibility-outline-rounded v-show="!showPassword" />
                </span>
              </a>
            </div>
            <div class="invalid-feedback" v-show="passwordError">
              {{ passwordError ? t(passwordError, { min: 8 }) : '' }}
            </div>
          </div>
        </div>
        <div class="row mb-3">
          <label for="hide-ssid" class="col-sm-3 col-md-2 col-form-label">{{ t('wifi.hide_ssid') }}</label>
          <div class="col-sm-4">
            <div class="form-check">
              <md-checkbox touch-target="wrapper" :checked="hideSSID" @change="updateConfig" id="hide-ssid" />
            </div>
          </div>
        </div>
      </form>
      <monaco-editor language="ini" @change="updateForm" height="700" v-model="config" v-show="currentTab === 1" />
    </div>
  </div>
</template>

<script setup lang="ts">
import gql from 'graphql-tag'
import { hostapdFragment } from '@/lib/api/fragments'
import { ref } from 'vue'
import toast from '@/components/toaster'
import { useI18n } from 'vue-i18n'
import { useField, useForm } from 'vee-validate'
import { string } from 'yup'
import { initQuery } from '@/lib/api/query'
import { initMutation } from '@/lib/api/mutation'
import { parseConfigString, updateLineItem } from '@/lib/hostapd/hostapd'
const { handleSubmit } = useForm()

const { t } = useI18n()

const currentTab = ref(0)
const config = ref('')
const { value: password, errorMessage: passwordError } = useField('password', string().required().min(8))
const { value: ssid, errorMessage: ssidError } = useField('ssid', string().required())
const showPassword = ref(false)
const isEnabled = ref(false)
const hideSSID = ref(false)

function toggleEye() {
  showPassword.value = !showPassword.value
}

initQuery({
  handle: (data: any, error: string) => {
    if (error) {
      toast(t(error), 'error')
    } else {
      config.value = data.hostapd.config
      isEnabled.value = data.hostapd.isEnabled
      updateForm()
    }
  },
  document: gql`
    query {
      hostapd {
        ...HostapdFragment
      }
    }
    ${hostapdFragment}
  `,
})

const { mutate, loading } = initMutation({
  document: gql`
    mutation applyHostapd($config: String!, $enable: Boolean!) {
      applyHostapd(config: $config, enable: $enable) {
        ...HostapdFragment
      }
    }
    ${hostapdFragment}
  `,
})

const save = handleSubmit(async () => {
  if (!config.value) {
    return
  }
  mutate({
    config: config.value,
    enable: isEnabled.value,
  })
})

function updateConfig() {
  const items = parseConfigString(config.value)
  updateLineItem(items, 'ssid', ssid.value ?? '')
  updateLineItem(items, 'wpa_passphrase', password.value ?? '')
  updateLineItem(items, 'ignore_broadcast_ssid', hideSSID.value ? '1' : '0')
  config.value = items.map((it) => it.line).join('\n')
}

function updateForm() {
  const items = parseConfigString(config.value)
  ssid.value = items.find((it) => it.key == 'ssid')?.value ?? ''
  password.value = items.find((it) => it.key == 'wpa_passphrase')?.value ?? ''
  hideSSID.value = items.find((it) => it.key == 'ignore_broadcast_ssid')?.value === '1'
}
</script>
