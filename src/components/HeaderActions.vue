<template>
  <div class="h-action" style="position: relative">
    <md-menu
      anchor="lang-ref"
      menu-corner="START_END"
      anchor-corner="END_END"
      stay-open-on-focusout
      quick
      :open="langMenuVisible"
      @closed="() => (langMenuVisible = false)"
    >
      <md-menu-item v-for="lang in langs" :headline="lang.name" @click="changeLang(lang.value)" />
    </md-menu>

    <button
      class="icon-button"
      id="lang-ref"
      @click="() => (langMenuVisible = true)"
      v-tooltip="t('header_actions.language')"
    >
      <md-ripple />
      <i-material-symbols:translate-rounded />
    </button>
  </div>

  <div class="h-action" style="position: relative">
    <md-menu
      anchor="theme-ref"
      menu-corner="START_END"
      anchor-corner="END_END"
      stay-open-on-focusout
      quick
      :open="themeMenuVisible"
      @closed="() => (themeMenuVisible = false)"
    >
      <theme-changer />
    </md-menu>

    <button
      class="icon-button"
      id="theme-ref"
      @click="() => (themeMenuVisible = true)"
      v-tooltip="t('header_actions.theme')"
    >
      <md-ripple />
      <i-material-symbols:palette-outline />
    </button>
  </div>

  <button
    class="icon-button h-action"
    style="margin-inline-end: 8px"
    @click="logout"
    v-if="props.loggedIn"
    v-tooltip="t('header_actions.logout')"
  >
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
