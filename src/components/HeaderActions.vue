<template>
  <div class="h-action">
    <v-dropdown v-model="menuVisible">
      <template #trigger>
        <button id="menu-ref" v-tooltip="t('settings')" class="btn-icon">
          <i-lucide:ellipsis-vertical />
        </button>
      </template>
      
      <!-- Language Section -->
      <div class="dropdown-section">
        <div class="dropdown-section-title">{{ t('header_actions.language') }}</div>
        <div v-for="lang in langs" :key="lang.value" class="dropdown-item" @click="changeLang(lang.value)">
          {{ lang.name }}
        </div>
      </div>
      
      <!-- Theme Section -->
      <div class="dropdown-section">
        <div class="dropdown-section-title">{{ t('header_actions.theme') }}</div>
        <theme-changer />
      </div>
      
      <!-- Logout Section -->
      <div v-if="props.loggedIn" class="dropdown-section">
        <div class="dropdown-item" @click="logout">
          <i-material-symbols:logout-rounded style="margin-inline-end: 8px;" />
          {{ t('header_actions.logout') }}
        </div>
      </div>
    </v-dropdown>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  loggedIn: { type: Boolean },
})

const menuVisible = ref(false)
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
  menuVisible.value = false
  locale.value = loc
  localStorage.setItem('locale', loc)
  document.title = t('app_name')
}

function logout() {
  menuVisible.value = false
  localStorage.clear()
  window.location.reload()
}
</script>

<style lang="scss" scoped>
.h-action {
  padding: 0 8px;
}

.dropdown-section {
  &:not(:last-child) {
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 8px;
  }
}

.dropdown-section-title {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--md-sys-color-on-surface-variant);
  padding: 8px 12px 4px;
  text-transform: uppercase;
}
</style>
