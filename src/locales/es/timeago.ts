import type { TimeagoMessages } from '@/lib/timeago'

export default {
  justNow: ['hace un momento', 'en un momento'],
  units: [
    { single: 'segundo', many: 'segundos' },
    { single: 'minuto', many: 'minutos' },
    { single: 'hora', many: 'horas' },
    { single: 'día', many: 'días' },
    { single: 'semana', many: 'semanas' },
    { single: 'mes', many: 'meses' },
    { single: 'año', many: 'años' },
  ],
  template: { past: 'hace {n} {unit}', future: 'en {n} {unit}' },
  plural: (n, single, many) => (n === 1 ? single : many),
} as const satisfies TimeagoMessages
