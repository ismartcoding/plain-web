import type { TimeagoMessages } from '@/lib/timeago'

export default {
  justNow: ['şimdi', 'şimdi'],
  units: [
    { single: 'saniye', many: 'saniye' },
    { single: 'dakika', many: 'dakika' },
    { single: 'saat', many: 'saat' },
    { single: 'gün', many: 'gün' },
    { single: 'hafta', many: 'hafta' },
    { single: 'ay', many: 'ay' },
    { single: 'yıl', many: 'yıl' },
  ],
  template: { past: '{n} {unit} önce', future: '{n} {unit} sonra' },
  plural: (_n, single) => single,
} as const satisfies TimeagoMessages
