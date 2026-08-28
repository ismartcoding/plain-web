import { afterEach, describe, expect, it, vi } from 'vitest'
import emitter from '@/plugins/eventbus'
import {
  discardMmsSendResult,
  SMS_RESULT_LEDGER_TTL_MS,
  subscribeSmsSendResults,
  takeMmsSendResult,
  takeSmsSendResult,
} from '@/lib/sms-result-ledger'

afterEach(() => vi.useRealTimers())

describe('SMS result ledger', () => {
  it('queues a correlated SMS result while its thread has no active listener', () => {
    emitter.emit('sms_send_result', { clientId: 'inactive-sms', success: false, resultCode: 1 })

    expect(takeSmsSendResult('inactive-sms')).toEqual({
      clientId: 'inactive-sms', success: false, resultCode: 1,
    })
  })

  it('delivers active results once without leaving a queued duplicate', () => {
    const handler = vi.fn(() => true)
    const unsubscribe = subscribeSmsSendResults(handler)

    emitter.emit('sms_send_result', { clientId: 'active-sms', success: true })
    unsubscribe()

    expect(handler).toHaveBeenCalledOnce()
    expect(takeSmsSendResult('active-sms')).toBeUndefined()
  })

  it('queues an MMS timeout for its inactive originating thread', () => {
    emitter.emit('mms_send_result', { pendingId: 'inactive-mms', success: false, resultCode: -1000 })

    expect(takeMmsSendResult('inactive-mms')).toEqual({
      pendingId: 'inactive-mms', success: false, resultCode: -1000,
    })
  })

  it('queues legacy MMS success while its originating thread is inactive', () => {
    emitter.emit('mms_sent', 'successful-mms')

    expect(takeMmsSendResult('successful-mms')).toEqual({
      pendingId: 'successful-mms', success: true,
    })
  })

  it('expires orphaned results after a bounded window longer than backend completion', () => {
    vi.useFakeTimers()
    emitter.emit('sms_send_result', { clientId: 'orphan-sms', success: true })
    vi.advanceTimersByTime(SMS_RESULT_LEDGER_TTL_MS)
    expect(takeSmsSendResult('orphan-sms')).toBeUndefined()
  })

  it('lets modal MMS flows explicitly discard a result with no optimistic owner', () => {
    emitter.emit('mms_sent', 'modal-mms')
    discardMmsSendResult('modal-mms')
    expect(takeMmsSendResult('modal-mms')).toBeUndefined()
  })
})
