import type { TimeagoMessages } from '@/lib/timeago'

export default {
  justNow: ['zojuist', 'straks'],
  units: [
    { single: 'seconde', many: 'seconden' },
    { single: 'minuut', many: 'minuten' },
    { single: 'uur', many: 'uur' },
    { single: 'dag', many: 'dagen' },
    { single: 'week', many: 'weken' },
    { single: 'maand', many: 'maanden' },
    { single: 'jaar', many: 'jaar' },
  ],
  template: { past: '{n} {unit} geleden', future: 'over {n} {unit}' },
  plural: (n, single, many) => (n === 1 ? single : many),
} as const satisfies TimeagoMessages
