import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api/gql-client', () => ({
  gqlFetch: vi.fn(),
  GqlError: class GqlError extends Error {},
}))

import { gqlFetch } from '@/lib/api/gql-client'
import { sendSmsWithCompatibility } from '@/lib/sms-send'

const mockFetch = gqlFetch as ReturnType<typeof vi.fn>

describe('SMS send schema compatibility', () => {
  beforeEach(() => vi.clearAllMocks())

  it('passes the optimistic pending ID to participant-aware servers', async () => {
    mockFetch.mockResolvedValue({ data: { sendSms: true } })

    await expect(sendSmsWithCompatibility({
      number: '+15551234567', body: 'hello', subscriptionId: 1, clientId: 'pending-a',
    })).resolves.toEqual({ ok: true })

    expect(mockFetch).toHaveBeenCalledOnce()
    expect(mockFetch.mock.calls[0][1]).toMatchObject({ clientId: 'pending-a' })
  })

  it('retries the legacy mutation only for an unknown clientId argument', async () => {
    mockFetch
      .mockResolvedValueOnce({ data: null, errors: [{ message: 'Unknown argument "clientId" on field "sendSms"' }] })
      .mockResolvedValueOnce({ data: { sendSms: true } })

    await expect(sendSmsWithCompatibility({
      number: '+15551234567', body: 'hello', subscriptionId: 1, clientId: 'pending-a',
    })).resolves.toEqual({ ok: true, legacy: true })

    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(mockFetch.mock.calls[1][1]).not.toHaveProperty('clientId')
  })

  it('does not risk a duplicate send by retrying ordinary mutation failures', async () => {
    mockFetch.mockResolvedValue({ data: null, errors: [{ message: 'SEND_SMS denied' }] })

    await expect(sendSmsWithCompatibility({
      number: '+15551234567', body: 'hello', subscriptionId: 1, clientId: 'pending-a',
    })).resolves.toEqual({ ok: false, error: 'SEND_SMS denied' })
    expect(mockFetch).toHaveBeenCalledOnce()
  })
})
