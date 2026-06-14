import type { TimeagoMessages } from '@/lib/timeago'

const units = ['秒', '分钟', '小时', '天', '周', '个月', '年']

export default {
  justNow: ['刚刚', '片刻后'],
  units: units.map((single) => ({ single, many: single })),
  template: { past: '{n} {unit}前', future: '{n} {unit}后' },
  plural: (_n, single) => single,
} as const satisfies TimeagoMessages
