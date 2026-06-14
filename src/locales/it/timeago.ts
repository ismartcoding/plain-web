import type { TimeagoMessages } from '@/lib/timeago'

export default {
  justNow: ['proprio ora', 'tra poco'],
  units: [
    { single: 'secondo', many: 'secondi' },
    { single: 'minuto', many: 'minuti' },
    { single: 'ora', many: 'ore' },
    { single: 'giorno', many: 'giorni' },
    { single: 'settimana', many: 'settimane' },
    { single: 'mese', many: 'mesi' },
    { single: 'anno', many: 'anni' },
  ],
  template: { past: '{n} {unit} fa', future: 'tra {n} {unit}' },
  plural: (n, single, many) => (n === 1 ? single : many),
} as const satisfies TimeagoMessages
