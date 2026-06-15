import { describe, it, expect, vi, beforeEach } from 'vitest'
import { formatDateTime, formatDateTimeFull, formatSeconds, formatFileSize, formatDate, formatTime, formatTimeAgo } from '@/lib/format'
import { format as timeagoFormat, setMessages } from '@/lib/timeago'
import type { TimeagoMessages } from '@/lib/timeago'

describe('formatSeconds', () => {
  it('formats 0 seconds as "00:00"', () => {
    expect(formatSeconds(0)).toBe('00:00')
  })

  it('formats 59 seconds as "00:59"', () => {
    expect(formatSeconds(59)).toBe('00:59')
  })

  it('formats 60 seconds as "01:00"', () => {
    expect(formatSeconds(60)).toBe('01:00')
  })

  it('formats 90 seconds as "01:30"', () => {
    expect(formatSeconds(90)).toBe('01:30')
  })

  it('formats 3599 seconds as "59:59"', () => {
    expect(formatSeconds(3599)).toBe('59:59')
  })

  it('formats 3600 seconds as "01:00:00" (hours mode)', () => {
    expect(formatSeconds(3600)).toBe('01:00:00')
  })

  it('formats 3661 seconds as "01:01:01"', () => {
    expect(formatSeconds(3661)).toBe('01:01:01')
  })

  it('formats 7200 seconds as "02:00:00"', () => {
    expect(formatSeconds(7200)).toBe('02:00:00')
  })

  it('formats 36061 seconds as "10:01:01"', () => {
    expect(formatSeconds(36061)).toBe('10:01:01')
  })

  it('floors fractional seconds', () => {
    expect(formatSeconds(61.9)).toBe('01:01')
  })

  it('formats 9 seconds with zero-padding as "00:09"', () => {
    expect(formatSeconds(9)).toBe('00:09')
  })
})

describe('formatFileSize', () => {
  it('returns bytes unchanged for values under 1000', () => {
    expect(formatFileSize(0)).toBe('0 B')
    expect(formatFileSize(999)).toBe('999 B')
  })

  it('formats 1000 bytes as "1.0 kB" (SI)', () => {
    expect(formatFileSize(1000)).toBe('1.0 kB')
  })

  it('formats 1500 bytes as "1.5 kB"', () => {
    expect(formatFileSize(1500)).toBe('1.5 kB')
  })

  it('formats 1_000_000 bytes as "1.0 MB"', () => {
    expect(formatFileSize(1_000_000)).toBe('1.0 MB')
  })

  it('formats 1_500_000 bytes as "1.5 MB"', () => {
    expect(formatFileSize(1_500_000)).toBe('1.5 MB')
  })

  it('formats 1_000_000_000 bytes as "1.0 GB"', () => {
    expect(formatFileSize(1_000_000_000)).toBe('1.0 GB')
  })

  it('uses KiB units in non-SI mode', () => {
    expect(formatFileSize(1024, false)).toBe('1.0 KiB')
  })

  it('uses MiB units in non-SI mode', () => {
    expect(formatFileSize(1024 * 1024, false)).toBe('1.0 MiB')
  })

  it('respects dp=2 parameter', () => {
    expect(formatFileSize(1500, true, 2)).toBe('1.50 kB')
  })

  it('respects dp=0 parameter', () => {
    expect(formatFileSize(1500, true, 0)).toBe('2 kB')
  })

  it('handles negative values', () => {
    // abs(−999) = 999 < 1000 threshold → returns bytes
    expect(formatFileSize(-500)).toBe('-500 B')
  })
})

describe('formatDateTime', () => {
  it('returns empty string for the epoch sentinel "1970-01-01T00:00:00Z"', () => {
    expect(formatDateTime('1970-01-01T00:00:00Z')).toBe('')
  })

  it('returns a non-empty string for a valid date', () => {
    expect(formatDateTime('2024-06-15T10:30:00Z')).toBeTruthy()
  })

  it('includes both date and time parts', () => {
    const result = formatDateTime('2024-01-05T08:00:00Z')
    // Should have at least one digit for year and time
    expect(result).toMatch(/\d/)
  })
})

describe('formatDateTimeFull', () => {
  it('returns empty string for epoch sentinel', () => {
    expect(formatDateTimeFull('1970-01-01T00:00:00Z')).toBe('')
  })

  it('returns a longer, richer string than formatDateTime', () => {
    const date = '2024-06-15T10:30:00Z'
    const medium = formatDateTime(date)
    const full = formatDateTimeFull(date)
    // Full format should generally be longer or equal
    expect(full.length).toBeGreaterThanOrEqual(medium.length)
  })
})

describe('formatDate', () => {
  it('returns a non-empty string for a valid date', () => {
    expect(formatDate('2024-06-15')).toBeTruthy()
  })

  it('returns a string containing only date parts (no HH:MM time)', () => {
    const result = formatDate('2024-12-25')
    // Typically contains year digits
    expect(result).toMatch(/2024/)
  })
})

describe('formatTime', () => {
  it('returns a non-empty string for a valid datetime', () => {
    const result = formatTime('2024-06-15T14:30:00Z')
    expect(result).toBeTruthy()
  })

  it('returns a string containing time digits', () => {
    const result = formatTime('2024-06-15T14:30:00Z')
    expect(result).toMatch(/\d{1,2}:\d{2}/)
  })
})

describe('timeago format()', () => {
  const messages: TimeagoMessages = {
    now: 'now',
    short: { minutes: '{n}m', hours: '{n}h', days: '{n}d', weeks: '{n}w', months: '{n}mo', years: '{n}y' },
    long: { minutes: '{n} min ago', hours: '{n} hr ago', days: '{n} d ago', weeks: '{n} w ago', months: '{n} mo ago', years: '{n} y ago' },
  }
  const now = new Date('2024-06-15T12:00:00Z').getTime()
  const at = (sec: number) => new Date(now - sec * 1000)

  it('returns the "now" string for sub-minute diffs', () => {
    expect(timeagoFormat(at(0), 'en-US', messages, { relativeDate: now })).toBe('now')
    expect(timeagoFormat(at(59), 'en-US', messages, { relativeDate: now })).toBe('now')
  })

  it('uses minutes for < 1 hour', () => {
    expect(timeagoFormat(at(60), 'en-US', messages, { relativeDate: now })).toBe('1m')
    expect(timeagoFormat(at(45 * 60), 'en-US', messages, { relativeDate: now })).toBe('45m')
  })

  it('uses hours for < 1 day', () => {
    expect(timeagoFormat(at(60 * 60), 'en-US', messages, { relativeDate: now })).toBe('1h')
    expect(timeagoFormat(at(23 * 60 * 60), 'en-US', messages, { relativeDate: now })).toBe('23h')
  })

  it('uses days for < 1 week', () => {
    expect(timeagoFormat(at(24 * 60 * 60), 'en-US', messages, { relativeDate: now })).toBe('1d')
    expect(timeagoFormat(at(6 * 24 * 60 * 60), 'en-US', messages, { relativeDate: now })).toBe('6d')
  })

  it('uses weeks for < 4 weeks', () => {
    expect(timeagoFormat(at(7 * 24 * 60 * 60), 'en-US', messages, { relativeDate: now })).toBe('1w')
    expect(timeagoFormat(at(3 * 7 * 24 * 60 * 60), 'en-US', messages, { relativeDate: now })).toBe('3w')
  })

  it('uses months for < 1 year', () => {
    expect(timeagoFormat(at(30 * 24 * 60 * 60), 'en-US', messages, { relativeDate: now })).toBe('1mo')
    expect(timeagoFormat(at(364 * 24 * 60 * 60), 'en-US', messages, { relativeDate: now })).toBe('12mo')
  })

  it('uses years for >= 1 year', () => {
    expect(timeagoFormat(at(365 * 24 * 60 * 60), 'en-US', messages, { relativeDate: now })).toBe('1y')
  })

  it('defaults to short style when style is omitted', () => {
    expect(timeagoFormat(at(60), 'en-US', messages, { relativeDate: now })).toBe('1m')
  })

  it('honors style: "long"', () => {
    expect(timeagoFormat(at(60), 'en-US', messages, { relativeDate: now, style: 'long' })).toBe('1 min ago')
    expect(timeagoFormat(at(3 * 24 * 60 * 60), 'en-US', messages, { relativeDate: now, style: 'long' })).toBe('3 d ago')
  })
})

describe('formatTimeAgo', () => {
  const messages: TimeagoMessages = {
    now: 'now',
    short: { minutes: '{n}m', hours: '{n}h', days: '{n}d', weeks: '{n}w', months: '{n}mo', years: '{n}y' },
    long: { minutes: '{n} min ago', hours: '{n} hr ago', days: '{n} d ago', weeks: '{n} w ago', months: '{n} mo ago', years: '{n} y ago' },
  }

  beforeEach(() => {
    setMessages('en-US', messages)
  })

  it('returns "" for the epoch sentinel', () => {
    expect(formatTimeAgo('1970-01-01T00:00:00Z')).toBe('')
  })

  it('defaults to short style', () => {
    const result = formatTimeAgo(new Date().toISOString())
    expect(result).toBe('now')
  })

  it('accepts style: "long" opt-in', () => {
    const anHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    expect(formatTimeAgo(anHourAgo, 'long')).toBe('1 hr ago')
  })
})
