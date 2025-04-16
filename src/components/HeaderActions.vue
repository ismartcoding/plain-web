<template>
  <div class="h-action" style="position: relative">
    <button id="lang-ref" v-tooltip="t('header_actions.language')" class="btn-icon" @click="() => (langMenuVisible = true)">
      <md-ripple />
      <i-material-symbols:translate-rounded />
    </button>
    <md-menu anchor="lang-ref" stay-open-on-focusout quick :open="langMenuVisible" @closed="() => (langMenuVisible = false)">
      <md-menu-item v-for="lang in langs" :key="lang.value" @click="changeLang(lang.value)">
        <div slot="headline">{{ lang.name }}</div>
      </md-menu-item>
    </md-menu>
  </div>

  <div class="h-action" style="position: relative">
    <button id="theme-ref" v-tooltip="t('header_actions.theme')" class="btn-icon" @click="() => (themeMenuVisible = true)">
      <md-ripple />
      <i-material-symbols:sunny-outline-rounded />
    </button>
    <md-menu anchor="theme-ref" stay-open-on-focusout quick :open="themeMenuVisible" @closed="() => (themeMenuVisible = false)">
      <theme-changer />
    </md-menu>
  </div>

  <button v-if="props.loggedIn" v-tooltip="$t('header_actions.logout')" class="btn-icon h-action" style="margin-inline-end: 8px" @click="logout">
    <md-ripple />
    <i-material-symbols:logout-rounded />
  </button>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  loggedIn: { type: Boolean },
})

const langMenuVisible = ref(false)
const themeMenuVisible = ref(false)
const { locale, t } = useI18n()

const langs = [
  { name: 'English', value: 'en-US' },
  { name: '简体中文', value: 'zh-CN' },
  { name: '繁体中文', value: 'zh-TW' },
  { name: 'español', value: 'es' },
  { name: '日本語', value: 'ja' },
  { name: 'Nederlands', value: 'nl' },
  { name: 'italiano', value: 'it' },
  { name: 'हिन्दी', value: 'hi' },
  { name: 'français', value: 'fr' },
  { name: 'русский язык', value: 'ru' },
  { name: 'বাংলা', value: 'bn' },
  { name: 'Deutsch', value: 'de' },
  { name: 'Português', value: 'pt' },
  { name: 'தமிழ்', value: 'ta' },
  { name: '한국어', value: 'ko' },
  { name: 'Türkçe', value: 'tr' },
  { name: 'Tiếng Việt', value: 'vi' },
]

function changeLang(loc: string) {
  langMenuVisible.value = false
  locale.value = loc
  localStorage.setItem('locale', loc)
  document.title = t('app_name')
}

function logout() {
  localStorage.clear()
  window.location.reload()
}
</script>

<style lang="scss" scoped>
.h-action {
  padding: 0 8px;
}
</style>
