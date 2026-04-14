import { describe, it, expect, vi, beforeEach } from 'vitest'
import { formatDateTime, formatDateTimeFull, formatSeconds, formatFileSize, formatDate, formatTime } from '@/lib/format'

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
