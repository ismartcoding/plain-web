import { createI18n } from 'vue-i18n'
import en_US from '@/locales/en-US'
import zh_CN from '@/locales/zh-CN'
import { setLocale } from 'yup'

setLocale({
  mixed: {
    required: 'valid.required',
  },
  string: {
    min: 'valid.string_min',
  },
})

export default createI18n({
  legacy: false,
  locale: localStorage.getItem('locale') ?? navigator.languages?.[0],
  fallbackLocale: 'en-US',
  messages: {
    'en-US': en_US,
    'zh-CN': zh_CN,
  },
})
