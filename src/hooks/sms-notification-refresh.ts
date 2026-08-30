import type { INotification } from '@/lib/interfaces'
import emitter from '@/plugins/eventbus'
import { shouldTriggerRefresh } from '@/lib/sms-whitelist'

export const SMS_NOTIFICATION_REFRESH_DELAY_MS = 500

export function createSmsNotificationRefresh(refresh: () => void, reconnect?: () => void) {
  let timeout: ReturnType<typeof setTimeout> | undefined
  let subscribed = false

  function handleNotification(notification: INotification) {
    if (!shouldTriggerRefresh(notification)) return
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => {
      timeout = undefined
      refresh()
    }, SMS_NOTIFICATION_REFRESH_DELAY_MS)
  }

  function handleSmsChanged() {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => {
      timeout = undefined
      refresh()
    }, SMS_NOTIFICATION_REFRESH_DELAY_MS)
  }

  function handleConnectionChanged(connected: boolean) {
    if (connected) {
      refresh()
      reconnect?.()
    }
  }

  function handleMmsSent() {
    handleSmsChanged()
  }

  function subscribe() {
    if (subscribed) return
    subscribed = true
    emitter.on('notification_created', handleNotification)
    emitter.on('notification_updated', handleNotification)
    emitter.on('sms_changed', handleSmsChanged)
    emitter.on('mms_sent', handleMmsSent)
    emitter.on('app_socket_connection_changed', handleConnectionChanged)
  }

  function unsubscribe() {
    if (!subscribed) return
    subscribed = false
    emitter.off('notification_created', handleNotification)
    emitter.off('notification_updated', handleNotification)
    emitter.off('sms_changed', handleSmsChanged)
    emitter.off('mms_sent', handleMmsSent)
    emitter.off('app_socket_connection_changed', handleConnectionChanged)
    if (timeout) clearTimeout(timeout)
    timeout = undefined
  }

  return { subscribe, unsubscribe }
}
