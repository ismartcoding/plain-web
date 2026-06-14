import type { TimeagoMessages } from '@/lib/timeago'

export default {
  justNow: ['только что', 'скоро'],
  units: [
    { single: 'секунда', many: 'секунд' },
    { single: 'минута', many: 'минут' },
    { single: 'час', many: 'часов' },
    { single: 'день', many: 'дней' },
    { single: 'неделя', many: 'недель' },
    { single: 'месяц', many: 'месяцев' },
    { single: 'год', many: 'лет' },
  ],
  template: { past: '{n} {unit} назад', future: 'через {n} {unit}' },
  plural: (n, single, many) => (n === 1 ? single : many),
} as const satisfies TimeagoMessages
