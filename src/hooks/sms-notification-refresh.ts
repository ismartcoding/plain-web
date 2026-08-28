import type { INotification } from '@/lib/interfaces'
import emitter from '@/plugins/eventbus'
import { shouldTriggerRefresh } from '@/lib/sms-whitelist'

export const SMS_NOTIFICATION_REFRESH_DELAY_MS = 500

export function createSmsNotificationRefresh(refresh: () => void) {
  let timeout: ReturnType<typeof setTimeout> | undefined

  function handleNotification(notification: INotification) {
    if (!shouldTriggerRefresh(notification)) return
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => {
      timeout = undefined
      refresh()
    }, SMS_NOTIFICATION_REFRESH_DELAY_MS)
  }

  function subscribe() {
    emitter.on('notification_created', handleNotification)
    emitter.on('notification_updated', handleNotification)
  }

  function unsubscribe() {
    emitter.off('notification_created', handleNotification)
    emitter.off('notification_updated', handleNotification)
    if (timeout) clearTimeout(timeout)
    timeout = undefined
  }

  return { subscribe, unsubscribe }
}
