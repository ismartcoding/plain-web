import type { TimeagoMessages } from '@/lib/timeago'

export default {
  now: 'Agora',
  short: {
    minutes: '{n} min',
    hours: '{n} h',
    days: '{n} d',
    weeks: '{n} sem',
    months: '{n} mês',
    years: '{n} ano',
  },
  long: {
    minutes: 'há {n} minutos',
    hours: 'há {n} horas',
    days: 'há {n} dias',
    weeks: 'há {n} semanas',
    months: 'há {n} meses',
    years: 'há {n} anos',
  },
} as const satisfies TimeagoMessages
