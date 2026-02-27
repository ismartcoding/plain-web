import { format } from './timeago'

function getLocale() {
  const locale = localStorage.getItem('locale') ?? navigator.language ?? 'en-US'
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

export function formatTimeAgo(str: string) {
  return format(new Date(str), getLocale().replace('-', '_'))
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

  if (Math.abs(bytes) < thresh) {
    return bytes + ' B'
  }

  const units = si ? ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'] : ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB']
  let u = -1
  const r = 10 ** dp

  do {
    bytes /= thresh
    ++u
  } while (Math.round(Math.abs(bytes) * r) / r >= thresh && u < units.length - 1)

  return bytes.toFixed(dp) + ' ' + units[u]
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
