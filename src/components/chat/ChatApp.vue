<template>
  <div class="chat-section" v-if="app">
    <div class="list-item">
      <span class="key">{{ $t('theme.title') }}</span>
      <span class="value">{{ $t(`theme.${app.theme.toLowerCase()}`) }}</span>
    </div>
    <div class="list-item">
      <span class="title">{{ $t('language.title') }}</span>
      <span class="value">{{ getLocaleValue(app.locale) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useTempStore } from '@/stores/temp'
import { storeToRefs } from 'pinia'
const { t } = useI18n()

const { app } = storeToRefs(useTempStore())

function getLocaleValue(locale: string) {
  if (locale === 'en-US') {
    return 'English'
  } else if (locale === 'zh-CN') {
    return '简体中文'
  }

  return t('language.system')
}
</script>
