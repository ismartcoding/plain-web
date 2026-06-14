import type { TimeagoMessages } from '@/lib/timeago'

export default {
  justNow: ['à l\u2019instant', 'dans un instant'],
  units: [
    { single: 'seconde', many: 'secondes' },
    { single: 'minute', many: 'minutes' },
    { single: 'heure', many: 'heures' },
    { single: 'jour', many: 'jours' },
    { single: 'semaine', many: 'semaines' },
    { single: 'mois', many: 'mois' },
    { single: 'an', many: 'ans' },
  ],
  template: { past: 'il y a {n} {unit}', future: 'dans {n} {unit}' },
  plural: (n, single, many) => (n === 1 ? single : many),
} as const satisfies TimeagoMessages
