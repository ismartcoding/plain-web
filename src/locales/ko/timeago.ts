import type { TimeagoMessages } from '@/lib/timeago'

export default {
  justNow: ['방금', '곧'],
  units: [
    { single: '초', many: '초' },
    { single: '분', many: '분' },
    { single: '시간', many: '시간' },
    { single: '일', many: '일' },
    { single: '주일', many: '주일' },
    { single: '개월', many: '개월' },
    { single: '년', many: '년' },
  ],
  template: { past: '{n}{unit} 전', future: '{n}{unit} 후' },
  plural: (n, single, many) => (n === 1 ? single : many),
} as const satisfies TimeagoMessages
