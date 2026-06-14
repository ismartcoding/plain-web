import type { TimeagoMessages } from '@/lib/timeago'

export default {
  justNow: ['agora mesmo', 'em breve'],
  units: [
    { single: 'segundo', many: 'segundos' },
    { single: 'minuto', many: 'minutos' },
    { single: 'hora', many: 'horas' },
    { single: 'dia', many: 'dias' },
    { single: 'semana', many: 'semanas' },
    { single: 'mês', many: 'meses' },
    { single: 'ano', many: 'anos' },
  ],
  template: { past: 'há {n} {unit}', future: 'em {n} {unit}' },
  plural: (n, single, many) => (n === 1 ? single : many),
} as const satisfies TimeagoMessages
