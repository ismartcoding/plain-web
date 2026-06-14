import type { TimeagoMessages } from '@/lib/timeago'

export default {
  justNow: ['すこし前', 'すぐに'],
  units: [
    { single: '秒', many: '秒' },
    { single: '分', many: '分' },
    { single: '時間', many: '時間' },
    { single: '日', many: '日' },
    { single: '週間', many: '週間' },
    { single: 'ヶ月', many: 'ヶ月' },
    { single: '年', many: '年' },
  ],
  template: { past: '{n}{unit}前', future: '{n}{unit}以内' },
  plural: (n, single, many) => (n === 1 ? single : many),
} as const satisfies TimeagoMessages
