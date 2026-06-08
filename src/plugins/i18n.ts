import { createI18n } from 'vue-i18n'
import { get as prefsGet } from '@/lib/prefs'
import en_US from '@/locales/en-US'

const FALLBACK_LOCALE = 'en-US'

// Static eager import for the fallback locale — it must be ready before the
// first render so the UI never shows missing keys on cold start. All other
// locales are loaded on demand through `loadLocaleMessages()`.
const eagerLocaleModules = import.meta.glob<{ default: Record<string, unknown> }>(
  '@/locales/*/index.ts',
  { eager: true },
)

const lazyLocaleLoaders = import.meta.glob<{ default: Record<string, unknown> }>(
  '@/locales/*/index.ts',
)

const LOCALE_DIRS = Object.keys(eagerLocaleModules)
  .map((path) => {
    const match = path.match(/\/locales\/([^/]+)\/index\.ts$/)
    return match ? match[1] : null
  })
  .filter((code): code is string => code !== null)

export const SUPPORTED_LOCALES: Array<{ code: string; name: string }> = [
  { code: 'en-US', name: 'English' },
  { code: 'zh-CN', name: '简体中文' },
  { code: 'zh-TW', name: '繁体中文' },
  { code: 'es', name: 'español' },
  { code: 'ja', name: '日本語' },
  { code: 'nl', name: 'Nederlands' },
  { code: 'it', name: 'italiano' },
  { code: 'hi', name: 'हिन्दी' },
  { code: 'fr', name: 'français' },
  { code: 'ru', name: 'русский язык' },
  { code: 'bn', name: 'বাংলা' },
  { code: 'de', name: 'Deutsch' },
  { code: 'pt', name: 'Português' },
  { code: 'ta', name: 'தமிழ்' },
  { code: 'ko', name: '한국어' },
  { code: 'tr', name: 'Türkçe' },
  { code: 'vi', name: 'Tiếng Việt' },
].filter((l) => LOCALE_DIRS.includes(l.code))

const initialLocale = (() => {
  const persisted = prefsGet<string>('locale', '')
  if (persisted && LOCALE_DIRS.includes(persisted)) return persisted
  const nav = typeof navigator !== 'undefined' ? navigator.language : ''
  if (nav && LOCALE_DIRS.includes(nav)) return nav
  return FALLBACK_LOCALE
})()

export const i18n = createI18n({
  legacy: false,
  locale: initialLocale,
  fallbackLocale: FALLBACK_LOCALE,
  messages: {
    [FALLBACK_LOCALE]: en_US,
  },
})

const loadedLocales = new Set<string>([FALLBACK_LOCALE])

const inflightLoaders = new Map<string, Promise<Record<string, unknown>>>()

export async function loadLocaleMessages(locale: string): Promise<Record<string, unknown>> {
  if (loadedLocales.has(locale)) {
    return (i18n.global.getLocaleMessage(locale) as Record<string, unknown>) ?? {}
  }
  const existing = inflightLoaders.get(locale)
  if (existing) return existing

  const loader = Object.entries(lazyLocaleLoaders).find(([path]) =>
    path.includes(`/locales/${locale}/index.ts`),
  )?.[1]
  if (!loader) {
    console.warn(`[i18n] no chunk registered for locale "${locale}"`)
    return {}
  }

  const promise = loader()
    .then((mod) => {
      const messages = mod.default ?? {}
      i18n.global.setLocaleMessage(locale, messages)
      loadedLocales.add(locale)
      return messages
    })
    .catch((err) => {
      console.error(`[i18n] failed to load locale "${locale}"`, err)
      return {}
    })
    .finally(() => {
      inflightLoaders.delete(locale)
    })

  inflightLoaders.set(locale, promise)
  return promise
}

export function isLocaleLoaded(locale: string): boolean {
  return loadedLocales.has(locale)
}

export default i18n
