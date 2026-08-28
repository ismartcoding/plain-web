import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createKeyedSmsSendDeadlines,
  createSmsSendDeadline,
  SMS_SEND_RESULT_TIMEOUT_MS,
} from '@/lib/sms-send-deadline'

afterEach(() => vi.useRealTimers())

describe('tracked SMS result deadline', () => {
  it('waits for the backend five-minute timeout plus grace', () => {
    vi.useFakeTimers()
    const onTimeout = vi.fn()
    const deadline = createSmsSendDeadline(onTimeout)
    deadline.start('pending-a')

    vi.advanceTimersByTime(SMS_SEND_RESULT_TIMEOUT_MS - 1)
    expect(onTimeout).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onTimeout).toHaveBeenCalledWith('pending-a')
  })

  it('consumes an eventual correlated result and cancels the deadline', () => {
    vi.useFakeTimers()
    const onTimeout = vi.fn()
    const deadline = createSmsSendDeadline(onTimeout)
    deadline.start('pending-a')

    vi.advanceTimersByTime(4 * 60 * 1000)
    expect(deadline.settle('pending-a')).toBe(true)
    vi.advanceTimersByTime(SMS_SEND_RESULT_TIMEOUT_MS)
    expect(onTimeout).not.toHaveBeenCalled()
  })

  it('tracks independent in-thread sends and times out only unsettled client IDs', () => {
    vi.useFakeTimers()
    const onTimeout = vi.fn()
    const deadlines = createKeyedSmsSendDeadlines(onTimeout)

    deadlines.start('first')
    vi.advanceTimersByTime(1000)
    deadlines.start('second')
    expect(deadlines.settle('first')).toBe(true)

    vi.advanceTimersByTime(SMS_SEND_RESULT_TIMEOUT_MS - 1000)
    expect(onTimeout).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1000)
    expect(onTimeout).toHaveBeenCalledOnce()
    expect(onTimeout).toHaveBeenCalledWith('second')
    expect(deadlines.settle('second')).toBe(false)
  })
})
