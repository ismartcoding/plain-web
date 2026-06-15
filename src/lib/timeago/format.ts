import { diffSec } from './utils/date'
import type { Opts, TDate, TimeagoMessages, TimeagoStyle } from './interface'

const MIN = 60
const HOUR = 60 * MIN
const DAY = 24 * HOUR
const WEEK = 7 * DAY
const MONTH = 30 * DAY
const YEAR = 365 * DAY

export function format(
  date: TDate,
  locale: string,
  messages: TimeagoMessages,
  opts?: Opts & { readonly style?: TimeagoStyle },
): string {
  const style: TimeagoStyle = opts?.style ?? 'short'
  const sec = diffSec(date, opts?.relativeDate)
  return formatWith(sec, messages, style)
}

function formatWith(sec: number, m: TimeagoMessages, style: TimeagoStyle): string {
  if (sec < MIN) return m.now
  const tmpl = pickBucket(sec, style, m)
  return tmpl.replace('{n}', String(computeN(sec)))
}

function pickBucket(sec: number, style: TimeagoStyle, m: TimeagoMessages): string {
  const t = style === 'short' ? m.short : m.long
  if (sec < HOUR) return t.minutes
  if (sec < DAY) return t.hours
  if (sec < WEEK) return t.days
  if (sec < 4 * WEEK) return t.weeks
  if (sec < YEAR) return t.months
  return t.years
}

function computeN(sec: number): number {
  if (sec < HOUR) return Math.max(1, Math.floor(sec / MIN))
  if (sec < DAY) return Math.max(1, Math.floor(sec / HOUR))
  if (sec < WEEK) return Math.max(1, Math.floor(sec / DAY))
  if (sec < 4 * WEEK) return Math.max(1, Math.floor(sec / WEEK))
  if (sec < YEAR) return Math.max(1, Math.floor(sec / MONTH))
  return Math.max(1, Math.floor(sec / YEAR))
}
