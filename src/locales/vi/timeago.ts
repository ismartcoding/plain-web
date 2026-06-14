import type { TimeagoMessages } from '@/lib/timeago'

export default {
  justNow: ['vừa xong', 'ngay bây giờ'],
  units: [
    { single: 'giây', many: 'giây' },
    { single: 'phút', many: 'phút' },
    { single: 'giờ', many: 'giờ' },
    { single: 'ngày', many: 'ngày' },
    { single: 'tuần', many: 'tuần' },
    { single: 'tháng', many: 'tháng' },
    { single: 'năm', many: 'năm' },
  ],
  template: { past: '{n} {unit} trước', future: '{n} {unit} nữa' },
  plural: (_n, single) => single,
} as const satisfies TimeagoMessages
