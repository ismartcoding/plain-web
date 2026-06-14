import type { TimeagoMessages } from '@/lib/timeago'

export default {
  justNow: ['अभी', 'अभी'],
  units: [
    { single: 'सेकंड', many: 'सेकंड' },
    { single: 'मिनट', many: 'मिनट' },
    { single: 'घंटा', many: 'घंटे' },
    { single: 'दिन', many: 'दिन' },
    { single: 'हफ़्ता', many: 'हफ़्ते' },
    { single: 'महीना', many: 'महीने' },
    { single: 'साल', many: 'साल' },
  ],
  template: { past: '{n} {unit} पहले', future: '{n} {unit} में' },
  plural: (_n, single) => single,
} as const satisfies TimeagoMessages
