import type { LocaleFunc, LocaleMap } from './interface'

/**
 * All supported locales
 */
const Locales: LocaleMap = {}

/**
 * register a locale
 * @param locale
 * @param func
 */
export const register = (locale: string, func: LocaleFunc) => {
  Locales[locale] = func
}

/**
 * get a locale, default is en_US
 * @param locale
 * @returns {*}
 */
export const getLocale = (locale: string): LocaleFunc => {
  return Locales[locale] || Locales['en_US']
}
