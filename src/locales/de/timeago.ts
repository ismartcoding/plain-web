import type { TimeagoMessages } from '@/lib/timeago'

export default {
  justNow: ['gerade eben', 'gleich'],
  units: [
    { single: 'Sekunde', many: 'Sekunden' },
    { single: 'Minute', many: 'Minuten' },
    { single: 'Stunde', many: 'Stunden' },
    { single: 'Tag', many: 'Tagen' },
    { single: 'Woche', many: 'Wochen' },
    { single: 'Monat', many: 'Monaten' },
    { single: 'Jahr', many: 'Jahren' },
  ],
  template: { past: 'vor {n} {unit}', future: 'in {n} {unit}' },
  plural: (n, single, many) => (n === 1 ? single : many),
} as const satisfies TimeagoMessages
