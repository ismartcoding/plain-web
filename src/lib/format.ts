import { format as timeagoFormat, getMessages } from './timeago'
import type { TimeagoStyle } from './timeago'
import { get as prefsGet } from '@/lib/prefs'

function getLocale(): string {
  const locale = prefsGet('locale', navigator.language ?? 'en-US')
  try {
    Intl.DateTimeFormat.supportedLocalesOf([locale])
    return locale
  } catch {
    return 'en-US'
  }
}

export function formatDateTime(str: string, options?: Intl.DateTimeFormatOptions | undefined) {
  if (str === '1970-01-01T00:00:00Z') {
    return ''
  }
  return new Intl.DateTimeFormat(getLocale(), {
    hour12: false,
    dateStyle: 'medium',
    timeStyle: 'short',
    ...options,
  }).format(new Date(str))
}

export function formatDateTimeFull(str: string) {
  if (str === '1970-01-01T00:00:00Z') {
    return ''
  }
  return formatDateTime(str, { dateStyle: 'long', timeStyle: 'long' })
}

export function formatTimeAgo(str: string, style: TimeagoStyle = 'short') {
  if (str === '1970-01-01T00:00:00Z') {
    return ''
  }
  const locale = getLocale()
  return timeagoFormat(new Date(str), locale, getMessages(locale)!, { style })
}

export function formatDate(str: string) {
  return new Intl.DateTimeFormat(getLocale()).format(new Date(str))
}

export function formatTime(str: string) {
  return new Intl.DateTimeFormat(getLocale(), { hour12: false, timeStyle: 'short' }).format(new Date(str))
}

export function formatSeconds(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = Math.floor(seconds % 60)

  const formattedHours = hours < 10 ? `0${hours}` : hours
  const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes
  const formattedSeconds = remainingSeconds < 10 ? `0${remainingSeconds}` : remainingSeconds

  if (hours > 0) {
    return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`
  } else {
    return `${formattedMinutes}:${formattedSeconds}`
  }
}

export function formatFileSize(bytes: number, si = true, dp = 1) {
  const thresh = si ? 1000 : 1024
  const units = si
    ? ['B', 'kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
    : ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB']
  let u = 0

  while (Math.abs(bytes) >= thresh && u < units.length - 1) {
    bytes /= thresh
    ++u
  }

  // The 'B' unit never gets decimals — byte counts are integers and
  // `1024.toFixed(1)` is noise. Apply the caller's `dp` only to higher units.
  const effectiveDp = units[u] === 'B' ? 0 : dp
  return bytes.toFixed(effectiveDp) + ' ' + units[u]
}

export function generateDownloadFileName(prefix: string) {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')

  return `${prefix}_${year}${month}${day}_${hours}${minutes}${seconds}.zip`
}
