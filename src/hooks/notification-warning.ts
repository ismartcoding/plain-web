import { ref, computed } from 'vue'
import { useTempStore } from '@/stores/temp'
import { storeToRefs } from 'pinia'
import { pushModal } from '@/components/modal'
import ConfirmModal from '@/components/ConfirmModal.vue'
import { useI18n } from 'vue-i18n'
import toast from '@/components/toaster'

const notificationPermission = ref(
  'Notification' in window && typeof Notification !== 'undefined' 
    ? Notification.permission 
    : 'default'
)

const isHttps = window.location.protocol === 'https:'

export function useNotificationWarning(options?: { showToast?: boolean }) {
  const { app } = storeToRefs(useTempStore())
  const { t } = useI18n()
  
  const hasWarning = computed(() => {
    return notificationPermission.value !== 'granted'
  })
  
  const warningMessage = computed(() => {
    if (!isHttps && notificationPermission.value !== 'granted') {
      return 'desktop_notification_need_https'
    } else if (notificationPermission.value !== 'granted') {
      return 'desktop_notification_permission_not_granted'
    }
    return ''
  })
  
  const useHttpsLink = () => {
    window.open(`https://${window.location.hostname}:${app.value.httpsPort}`, '_blank')
  }
  
  const grantPermission = () => {
    if (!('Notification' in window) || typeof Notification === 'undefined') {
      return
    }
    
    if (Notification.permission === 'denied') {
      if (options?.showToast) {
        toast(t('desktop_notification_permission_denied_help'), 'error')
      } else {
        pushModal(ConfirmModal, {
          title: t('desktop_notification_permission_grant_title'),
          message: t('desktop_notification_permission_grant_message'),
        })
      }
      return
    }
    
    Notification.requestPermission().then((permission) => {
      notificationPermission.value = permission
      if (options?.showToast && permission === 'granted') {
        toast(t('desktop_notification_permission_granted'))
      }
    })
  }
  
  const warningAction = computed(() => {
    if (!isHttps && notificationPermission.value !== 'granted') {
      return {
        text: 'use_https_link',
        action: useHttpsLink
      }
    } else if (notificationPermission.value !== 'granted') {
      return {
        text: 'grant_permission',
        action: grantPermission
      }
    }
    return null
  })
  
  return {
    hasWarning,
    warningMessage,
    warningAction,
    notificationPermission,
    useHttpsLink,
    grantPermission,
    isHttps
  }
} 