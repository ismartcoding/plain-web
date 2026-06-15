import type { TimeagoMessages } from '@/lib/timeago'

export default {
  now: 'now',
  short: {
    minutes: '{n}m',
    hours: '{n}h',
    days: '{n}d',
    weeks: '{n}w',
    months: '{n}mo',
    years: '{n}y',
  },
  long: {
    minutes: '{n} minutes ago',
    hours: '{n} hours ago',
    days: '{n} days ago',
    weeks: '{n} weeks ago',
    months: '{n} months ago',
    years: '{n} years ago',
  },
} as const satisfies TimeagoMessages
