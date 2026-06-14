import { diffSec } from './utils/date'
import type { Opts, TDate, TimeagoMessages } from './interface'

export function format(date: TDate, locale: string, messages: TimeagoMessages, opts?: Opts): string {
  const sec = diffSec(date, opts?.relativeDate)
  return formatWith(sec, messages)
}

function formatWith(sec: number, m: TimeagoMessages): string {
  const agoIn = sec < 0 ? 1 : 0
  const abs = Math.abs(sec)
  const bucket = pickBucket(abs)
  if (bucket.unitIndex < 0) return m.justNow[agoIn]
  const unit = m.units[bucket.unitIndex]
  const rendered = m.plural(bucket.n, unit.single, unit.many)
  const tmpl = agoIn === 0 ? m.template.past : m.template.future
  return tmpl.replace('{n}', String(bucket.n)).replace('{unit}', rendered)
}

function pickBucket(abs: number): { n: number; unitIndex: number } {
  const SECS = [60, 60, 24, 7, 365 / 7 / 12, 12]
  let idx = 0
  let diff = abs
  for (; diff >= SECS[idx] && idx < SECS.length; idx++) {
    diff /= SECS[idx]
  }
  const n = Math.floor(diff)
  if (idx === 0 && n <= 9) return { n, unitIndex: -1 }
  return { n, unitIndex: idx }
}
