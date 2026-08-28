import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { SMS_SEND_RESULT_TIMEOUT_MS } from '@/lib/sms-send-deadline'

const harness = vi.hoisted(() => ({ toast: vi.fn(), fetch: vi.fn() }))

vi.mock('@/components/toaster', () => ({ default: harness.toast }))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('@/lib/api/query', async () => {
  const { ref } = await vi.importActual<typeof import('vue')>('vue')
  return {
    smsGQL: 'sms-query',
    initLazyQuery: () => ({ loading: ref(false), fetch: harness.fetch }),
  }
})
vi.mock('@/hooks/tags', async () => {
  const { ref } = await vi.importActual<typeof import('vue')>('vue')
  return { useTags: () => ({ tags: ref([]), fetch: vi.fn() }) }
})
vi.mock('@/hooks/contacts', () => ({
  useContactName: () => ({ loadContacts: vi.fn(), getDisplayName: (value: string[]) => value.join(', ') }),
}))
vi.mock('@/hooks/sms-notification-refresh', () => ({
  createSmsNotificationRefresh: () => ({ subscribe: vi.fn(), unsubscribe: vi.fn() }),
}))

import { useMessageThread } from '@/hooks/message-thread'

afterEach(() => {
  harness.toast.mockReset()
  harness.fetch.mockReset()
  vi.useRealTimers()
})

describe('message thread pending operations', () => {
  it('toasts once when a correlated asynchronous SMS failure is duplicated', () => {
    const thread = useMessageThread(ref('thread-a'), ref())
    const clientId = thread.setPendingSms('hello', '+15551234567', 'client-a')

    expect(thread.handleSmsSendResult({ clientId, success: false }).handled).toBe(true)
    expect(thread.handleSmsSendResult({ clientId, success: false }).handled).toBe(false)
    expect(harness.toast).toHaveBeenCalledOnce()
    expect(harness.toast).toHaveBeenCalledWith('send_failed', 'error')
  })

  it('fails and restores only the SMS whose backend deadline expires', () => {
    vi.useFakeTimers()
    const thread = useMessageThread(ref('thread-a'), ref())
    const restore = vi.fn()
    thread.setTerminalHandlers({ onSmsFailure: restore, onMmsResult: vi.fn() })
    thread.setPendingSms('first', '+15551234567', 'client-a')
    thread.startPendingSmsDeadline('client-a')
    vi.advanceTimersByTime(1000)
    thread.setPendingSms('second', '+15551234567', 'client-b')
    thread.startPendingSmsDeadline('client-b')
    thread.handleSmsSendResult({ clientId: 'client-a', success: true })

    vi.advanceTimersByTime(SMS_SEND_RESULT_TIMEOUT_MS)

    expect(restore).toHaveBeenCalledOnce()
    expect(restore.mock.calls[0][0].body).toBe('second')
    expect(thread.pendingSmsItems.value.map((item) => item.id)).toEqual(['client-a'])
    expect(harness.toast).toHaveBeenCalledOnce()
  })

  it('does not start a deadline after a success result beats mutation acceptance', async () => {
    vi.useFakeTimers()
    const thread = useMessageThread(ref('thread-a'), ref())
    const restore = vi.fn()
    thread.setTerminalHandlers({ onSmsFailure: restore, onMmsResult: vi.fn() })
    const clientId = thread.setPendingSms('hello', '+15551234567', 'client-a')

    expect(thread.handleSmsSendResult({ clientId, success: true }).handled).toBe(true)
    thread.startPendingSmsDeadline(clientId)
    await vi.advanceTimersByTimeAsync(SMS_SEND_RESULT_TIMEOUT_MS)

    expect(thread.pendingSmsItems.value.map((item) => item.id)).toEqual([clientId])
    expect(restore).not.toHaveBeenCalled()
    expect(harness.toast).not.toHaveBeenCalled()
  })

  it('keeps two accepted MMS sends until reversed terminal outcomes identify each one', () => {
    const thread = useMessageThread(ref('thread-a'), ref())
    thread.setPendingMms('mms-a', 'first', '+15551234567', [])
    thread.setPendingMms('mms-b', 'second', '+15551234567', [])
    expect(thread.pendingMmsItems.value.map((item) => item.id)).toEqual(['mms-a', 'mms-b'])

    expect(thread.handleMmsSendResult({ pendingId: 'mms-b', success: false }).failed?.body).toBe('second')
    expect(thread.pendingMmsItems.value.map((item) => item.id)).toEqual(['mms-a'])
    expect(thread.handleMmsSendResult({ pendingId: 'mms-a', success: true }).handled).toBe(true)
    expect(thread.pendingMmsItems.value).toEqual([])
  })
})
