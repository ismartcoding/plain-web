import { createI18n } from 'vue-i18n'
import en_US from '@/locales/en-US'
import zh_CN from '@/locales/zh-CN'
import es from '@/locales/es'
import ja from '@/locales/ja'
import nl from '@/locales/nl'
import it from '@/locales/it'
import hi from '@/locales/hi'
import fr from '@/locales/fr'
import ru from '@/locales/ru'
import bn from '@/locales/bn'
import de from '@/locales/de'
import pt from '@/locales/pt'
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
    es: es,
    ja: ja,
    nl: nl,
    it: it,
    hi: hi,
    fr: fr,
    ru: ru,
    bn: bn,
    de: de,
    pt: pt,
  },
})
