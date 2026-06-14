import type { TimeagoMessages } from '@/lib/timeago'

export default {
  justNow: ['இப்போது', 'இப்போது'],
  units: [
    { single: 'வினாடி', many: 'வினாடிகள்' },
    { single: 'நிமிடம்', many: 'நிமிடங்கள்' },
    { single: 'மணி', many: 'மணி' },
    { single: 'நாள்', many: 'நாட்கள்' },
    { single: 'வாரம்', many: 'வாரங்கள்' },
    { single: 'மாதம்', many: 'மாதங்கள்' },
    { single: 'ஆண்டு', many: 'ஆண்டுகள்' },
  ],
  template: { past: '{n} {unit} முன்பு', future: '{n} {unit} இல்' },
  plural: (n, single, many) => (n === 1 ? single : many),
} as const satisfies TimeagoMessages
