import type { TimeagoMessages } from '@/lib/timeago'

export default {
  now: 'এইমাত্র',
  short: {
    minutes: '{n} মি',
    hours: '{n} ঘ',
    days: '{n} দি',
    weeks: '{n} সপ্তাহ',
    months: '{n} মাস',
    years: '{n} বছর',
  },
  long: {
    minutes: '{n} মিনিট আগে',
    hours: '{n} ঘণ্টা আগে',
    days: '{n} দিন আগে',
    weeks: '{n} সপ্তাহ আগে',
    months: '{n} মাস আগে',
    years: '{n} বছর আগে',
  },
} as const satisfies TimeagoMessages
