import type { TDate } from '../interface'

const SEC_ARRAY = [
  60, // 60 seconds in 1 min
  60, // 60 mins in 1 hour
  24, // 24 hours in 1 day
  7, // 7 days in 1 week
  365 / 7 / 12, // 4.345238095238096 weeks in 1 month
  12, // 12 months in 1 year
]

/**
 * format Date / string / timestamp to timestamp
 * @param input
 * @returns {*}
 */
export function toDate(input?: Date | string | number): Date {
  if (input instanceof Date) return input
  // @ts-ignore
  if (!isNaN(input) || /^\d+$/.test(input)) return new Date(parseInt(input))
  input = (input || '')
    // @ts-ignore
    .trim()
    .replace(/\.\d+/, '') // remove milliseconds
    .replace(/-/, '/')
    .replace(/-/, '/')
    .replace(/(\d)T(\d)/, '$1 $2')
    .replace(/Z/, ' UTC') // 2017-2-5T3:57:52Z -> 2017-2-5 3:57:52UTC
    .replace(/([+-]\d\d):?(\d\d)/, ' $1$2') // -04:00 -> -0400
  return new Date(input!)
}

/**
 * calculate the diff second between date to be formatted an now date.
 * @param date
 * @param relativeDate
 * @returns {number}
 */
export function diffSec(date: TDate, relativeDate?: TDate): number {
  const relDate = relativeDate ? toDate(relativeDate) : new Date()
  return (+relDate - +toDate(date)) / 1000
}

/**
 * nextInterval: calculate the next interval time.
 * - diff: the diff sec between now and date to be formatted.
 **/
export function nextInterval(diff: number): number {
  let rst = 1,
    i = 0,
    d = Math.abs(diff)
  for (; diff >= SEC_ARRAY[i] && i < SEC_ARRAY.length; i++) {
    diff /= SEC_ARRAY[i]
    rst *= SEC_ARRAY[i]
  }
  d = d % rst
  d = d ? rst - d : rst
  return Math.ceil(d)
}
