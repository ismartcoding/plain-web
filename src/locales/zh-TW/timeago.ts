import type { TimeagoMessages } from '@/lib/timeago'

const units = ['秒', '分鐘', '小時', '天', '週', '個月', '年']

export default {
  justNow: ['剛剛', '片刻後'],
  units: units.map((single) => ({ single, many: single })),
  template: { past: '{n} {unit}前', future: '{n} {unit}後' },
  plural: (_n, single) => single,
} as const satisfies TimeagoMessages
