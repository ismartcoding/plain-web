import type { TimeagoMessages } from '@/lib/timeago'

export default {
  justNow: ['এখনই', 'এখনই'],
  units: [
    { single: 'সেকেন্ড', many: 'সেকেন্ড' },
    { single: 'মিনিট', many: 'মিনিট' },
    { single: 'ঘন্টা', many: 'ঘন্টা' },
    { single: 'দিন', many: 'দিন' },
    { single: 'সপ্তাহ', many: 'সপ্তাহ' },
    { single: 'মাস', many: 'মাস' },
    { single: 'বছর', many: 'বছর' },
  ],
  template: { past: '{n} {unit} আগে', future: '{n} {unit} পরে' },
  plural: (_n, single) => single,
} as const satisfies TimeagoMessages
