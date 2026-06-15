import type { TimeagoMessages } from '@/lib/timeago'

export default {
  now: 'Zonet',
  short: {
    minutes: '{n} min',
    hours: '{n} u',
    days: '{n} d',
    weeks: '{n} wk',
    months: '{n} mnd',
    years: '{n} jr',
  },
  long: {
    minutes: '{n} minuten geleden',
    hours: '{n} uur geleden',
    days: '{n} dagen geleden',
    weeks: '{n} weken geleden',
    months: '{n} maanden geleden',
    years: '{n} jaar geleden',
  },
} as const satisfies TimeagoMessages
