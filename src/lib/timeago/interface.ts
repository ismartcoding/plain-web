export type TDate = Date | string | number

export type TimerPool = Record<number, number>

export type TimeagoStyle = 'short' | 'long'

export type Opts = {
  readonly relativeDate?: TDate
  readonly minInterval?: number
  readonly style?: TimeagoStyle
}

/**
 * Localization payload for one locale's timeago formatter. Provided by
 * `src/locales/<locale>/timeago.ts` and registered with `setMessages()`
 * on language switch. Mirrors plain-app's `RelativeTimeFormatter`
 * (see `app/src/main/java/com/ismartcoding/plain/helpers/RelativeTimeFormatter.kt`)
 * — every bucket ships as a pre-formatted template with `{n}` as the
 * number placeholder, so plural rules and unit suffixes stay in the
 * locale file alongside the strings.
 */
export interface TimeagoMessages {
  readonly now: string
  readonly short: TimeagoBucket
  readonly long: TimeagoBucket
}

export type TimeagoBucket = {
  readonly minutes: string
  readonly hours: string
  readonly days: string
  readonly weeks: string
  readonly months: string
  readonly years: string
}
