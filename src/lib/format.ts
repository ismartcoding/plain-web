function getLocale() {
  return localStorage.getItem('locale') ?? navigator.languages?.[0] ?? 'en-US'
}

export function formatDateTime(str: string, options?: {}) {
  return new Intl.DateTimeFormat(getLocale(), {
    hour12: false,
    dateStyle: 'short',
    timeStyle: 'short',
    ...options,
  }).format(new Date(str))
}

export function formatDateTimeFull(str: string) {
  return formatDateTime(str, { dateStyle: 'long', timeStyle: 'long' })
}

export function formatDate(str: string) {
  return new Intl.DateTimeFormat(getLocale()).format(new Date(str))
}

export function formatTime(str: string) {
  return new Intl.DateTimeFormat(getLocale(), { hour12: false, timeStyle: 'short' }).format(new Date(str))
}

export function formatSeconds(seconds: number) {
  let index = 11
  if (seconds < 3600) {
    index = 14
  }

  return new Date(seconds * 1000).toISOString().substring(index, 19)
}

export function formatFileSize(bytes: number, si = true, dp = 1) {
  const thresh = si ? 1000 : 1024

  if (Math.abs(bytes) < thresh) {
    return bytes + ' B'
  }

  const units = si
    ? ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
    : ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB']
  let u = -1
  const r = 10 ** dp

  do {
    bytes /= thresh
    ++u
  } while (Math.round(Math.abs(bytes) * r) / r >= thresh && u < units.length - 1)

  return bytes.toFixed(dp) + ' ' + units[u]
}
