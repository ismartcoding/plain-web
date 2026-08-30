import { describe, expect, it } from 'vitest'
import { settleMmsDraft } from '@/lib/mms-draft-sync'

describe('MMS draft settlement', () => {
  it('restores only the failed draft when two accepted sends settle in reverse order', () => {
    const firstFile = { name: 'first.jpg' }
    const secondFile = { name: 'second.jpg' }
    const drafts = new Map([
      ['first', { body: 'first body', files: [firstFile] }],
      ['second', { body: 'second body', files: [secondFile] }],
    ])

    expect(settleMmsDraft(drafts, 'second', false)).toEqual({
      handled: true,
      restore: { body: 'second body', files: [secondFile] },
    })
    expect([...drafts.keys()]).toEqual(['first'])
    expect(settleMmsDraft(drafts, 'first', true)).toEqual({ handled: true })
    expect(drafts.size).toBe(0)
  })
})
