import { afterEach, describe, expect, it, vi } from 'vitest'
import emitter from '@/plugins/eventbus'
import type { INotification } from '@/lib/interfaces'
import {
  createSmsNotificationRefresh,
  SMS_NOTIFICATION_REFRESH_DELAY_MS,
} from '@/hooks/sms-notification-refresh'

function notification(appId: string): INotification {
  return { appId } as INotification
}

const cleanups: Array<() => void> = []

afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup())
  vi.useRealTimers()
})

function subscribe(refresh: () => void) {
  const subscription = createSmsNotificationRefresh(refresh)
  subscription.subscribe()
  cleanups.push(subscription.unsubscribe)
  return subscription
}

describe('SMS notification refresh', () => {
  it('refreshes after a recognized SMS notification settles', () => {
    vi.useFakeTimers()
    const refresh = vi.fn()
    subscribe(refresh)

    emitter.emit('notification_created', notification('com.google.android.apps.messaging'))

    expect(refresh).not.toHaveBeenCalled()
    vi.advanceTimersByTime(SMS_NOTIFICATION_REFRESH_DELAY_MS)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('coalesces notification create and update events into one refresh', () => {
    vi.useFakeTimers()
    const refresh = vi.fn()
    subscribe(refresh)

    emitter.emit('notification_created', notification('com.android.mms'))
    vi.advanceTimersByTime(SMS_NOTIFICATION_REFRESH_DELAY_MS - 1)
    emitter.emit('notification_updated', notification('com.android.mms'))
    vi.advanceTimersByTime(SMS_NOTIFICATION_REFRESH_DELAY_MS - 1)

    expect(refresh).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('ignores notifications from unrelated apps', () => {
    vi.useFakeTimers()
    const refresh = vi.fn()
    subscribe(refresh)

    emitter.emit('notification_created', notification('com.example.calendar'))
    vi.advanceTimersByTime(SMS_NOTIFICATION_REFRESH_DELAY_MS)

    expect(refresh).not.toHaveBeenCalled()
  })

  it('cancels pending refreshes and listeners when unsubscribed', () => {
    vi.useFakeTimers()
    const refresh = vi.fn()
    const subscription = subscribe(refresh)

    emitter.emit('notification_created', notification('com.android.mms'))
    subscription.unsubscribe()
    emitter.emit('notification_updated', notification('com.android.mms'))
    vi.advanceTimersByTime(SMS_NOTIFICATION_REFRESH_DELAY_MS)

    expect(refresh).not.toHaveBeenCalled()
  })

  it('resumes refreshing after a view is reactivated', () => {
    vi.useFakeTimers()
    const refresh = vi.fn()
    const subscription = subscribe(refresh)

    subscription.unsubscribe()
    subscription.subscribe()
    emitter.emit('notification_created', notification('com.android.mms'))
    vi.advanceTimersByTime(SMS_NOTIFICATION_REFRESH_DELAY_MS)

    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('refreshes independent active consumers', () => {
    vi.useFakeTimers()
    const refreshThread = vi.fn()
    const refreshSidebar = vi.fn()
    subscribe(refreshThread)
    subscribe(refreshSidebar)

    emitter.emit('notification_updated', notification('com.android.mms'))
    vi.advanceTimersByTime(SMS_NOTIFICATION_REFRESH_DELAY_MS)

    expect(refreshThread).toHaveBeenCalledTimes(1)
    expect(refreshSidebar).toHaveBeenCalledTimes(1)
  })
})
