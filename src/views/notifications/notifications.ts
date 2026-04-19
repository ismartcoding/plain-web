import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTempStore } from '@/stores/temp'
import { storeToRefs } from 'pinia'
import { useMainStore } from '@/stores/main'
import { initQuery, notificationsGQL } from '@/lib/api/query'
import { initMutation, cancelNotificationsGQL, replyNotificationGQL } from '@/lib/api/mutation'
import toast from '@/components/toaster'
import type { INotification } from '@/lib/interfaces'
import { getFileUrlByPath } from '@/lib/api/file'
import emitter from '@/plugins/eventbus'
import { useNotificationWarning } from '@/hooks/notification-warning'
import { playNotificationSound } from '@/lib/notification-sound'

export function useNotifications() {
  const { t } = useI18n()
  const store = useMainStore()
  const { notificationSound } = storeToRefs(store)
  const { app, urlTokenKey } = storeToRefs(useTempStore())
  const { hasWarning: hasNotificationWarning, warningMessage: notificationWarningMessage, warningAction: notificationWarningAction } = useNotificationWarning()

  const notifications = ref<INotification[]>([])

  const { loading, refetch } = initQuery({
    handle: (data: any, error: string) => {
      if (data) {
        notifications.value = data.notifications.map((it: any) => ({ ...it, icon: getFileUrlByPath(urlTokenKey.value, 'pkgicon://' + it.appId) }))
      }
    },
    document: notificationsGQL,
  })

  const { mutate: cancelNotifications } = initMutation({ document: cancelNotificationsGQL })
  const { mutate: replyNotification, loading: replySending, onDone: onReplyDone, onError: onReplyError } = initMutation({ document: replyNotificationGQL })

  // Reply state
  const replyingId = ref<string | null>(null)
  const replyingActionIndex = ref<number>(0)
  const replyText = ref('')

  function startReply(id: string, actionIndex: number) { replyingId.value = id; replyingActionIndex.value = actionIndex; replyText.value = '' }
  function cancelReply() { replyingId.value = null; replyText.value = '' }
  function sendReply(id: string) {
    const text = replyText.value.trim()
    if (!text) return
    replyNotification({ id, actionIndex: replyingActionIndex.value, text })
  }

  onReplyDone(() => cancelReply())
  onReplyError(() => cancelReply())

  const deleteItem = (item: INotification) => cancelNotifications({ ids: [item.id] })
  const clearAll = () => {
    const ids = notifications.value.map((it) => it.id)
    notifications.value = []
    cancelNotifications({ ids })
  }

  // Desktop notification + sound helper
  function showDesktopNotification(data: INotification) {
    if (notificationSound.value) playNotificationSound()
    if ('Notification' in window && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      const n = new Notification(data.title, { body: data.body, icon: data.icon, silent: true })
      n.onclick = () => { window.focus(); n.close() }
    }
  }

  onMounted(() => {
    emitter.on('notification_created', async (data: any) => {
      data.icon = getFileUrlByPath(urlTokenKey.value, 'pkgicon://' + data.appId)
      notifications.value = [{ ...data }, ...notifications.value]
      showDesktopNotification(data)
    })

    emitter.on('notification_updated', async (data: any) => {
      data.icon = getFileUrlByPath(urlTokenKey.value, 'pkgicon://' + data.appId)
      notifications.value = notifications.value.map((n) => n.id === data.id ? { ...data } : n)
      showDesktopNotification(data)
    })

    emitter.on('notification_deleted', async (data: any) => {
      notifications.value = notifications.value.filter((n) => n.id !== data.id)
    })

    emitter.on('notification_refreshed', async () => refetch())
  })

  return {
    store, app, notificationSound, notifications, loading,
    hasNotificationWarning, notificationWarningMessage, notificationWarningAction,
    replyingId, replyText, replySending,
    startReply, cancelReply, sendReply, deleteItem, clearAll,
  }
}
