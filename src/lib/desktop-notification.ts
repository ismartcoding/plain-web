export type DesktopNotificationOptions = {
  title: string
  body?: string
  icon?: string
  silent?: boolean
}

export async function showDesktopNotification(options: DesktopNotificationOptions) {
  if (__IS_TAURI__) {
    const { isPermissionGranted, requestPermission, sendNotification } = await import('@tauri-apps/plugin-notification')
    let granted = await isPermissionGranted()
    if (!granted) {
      const permission = await requestPermission()
      granted = permission === 'granted'
    }
    if (!granted) return

    if (navigator.platform.toLowerCase().includes('mac')) {
      try {
        const { invoke } = await import('@tauri-apps/api/core')
        await invoke('send_macos_notification', { options })
        return
      } catch {
      }
    }

    await sendNotification({
      title: options.title,
      body: options.body,
      icon: options.icon,
      silent: options.silent,
    })
    return
  }

  if ('Notification' in window && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    const notification = new Notification(options.title, {
      body: options.body,
      icon: options.icon,
      silent: options.silent,
    })
    notification.onclick = () => {
      window.focus()
      notification.close()
    }
  }
}