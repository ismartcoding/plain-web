import type { TimeagoMessages } from '@/lib/timeago'

const units = ['second', 'minute', 'hour', 'day', 'week', 'month', 'year']

export default {
  justNow: ['just now', 'right now'],
  units: units.map((single) => ({ single, many: `${single}s` })),
  template: { past: '{n} {unit} ago', future: 'in {n} {unit}' },
  plural: (n, single, many) => (n === 1 ? single : many),
} as const satisfies TimeagoMessages
