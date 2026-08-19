import { ref, type Ref } from 'vue'
import { download } from '@/lib/api/file'

export function useScreenMirrorMedia(canvasRef: Ref<HTMLCanvasElement | undefined>, audioRef: Ref<HTMLAudioElement | undefined>) {
  const muted = ref(true)
  const isFullscreen = ref(false)

  const toggleMute = () => {
    const audio = audioRef.value
    if (audio) {
      audio.muted = !audio.muted
    }
    muted.value = !muted.value
  }

  const syncFullscreen = async () => {
    if (__IS_TAURI__) {
      const { getCurrentWindow } = await import('@tauri-apps/api/window')
      isFullscreen.value = await getCurrentWindow().isFullscreen()
    } else {
      isFullscreen.value = !!document.fullscreenElement
    }
  }

  const toggleFullscreen = async () => {
    if (__IS_TAURI__) {
      const { getCurrentWindow } = await import('@tauri-apps/api/window')
      const win = getCurrentWindow()
      isFullscreen.value = !(await win.isFullscreen())
      await win.setFullscreen(isFullscreen.value)
      return
    }
    const wrapper = document.querySelector('.video-wrapper')
    if (!wrapper) return
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      wrapper.requestFullscreen()
    }
  }

  let unlistenResize: (() => void) | null = null

  const attachFullscreenListener = async () => {
    if (!__IS_TAURI__) return
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    unlistenResize = await getCurrentWindow().onResized(() => {
      void syncFullscreen()
    })
  }

  const detachFullscreenListener = () => {
    unlistenResize?.()
    unlistenResize = null
  }

  const onFullscreenChange = () => {
    void syncFullscreen()
  }

  const takeScreenshot = () => {
    const canvas = canvasRef.value
    if (!canvas) return
    const d = new Date()
    const fileName = 'screenshot-' + [d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds()].join('') + '.png'
    download(canvas.toDataURL(), fileName)
  }

  return { muted, isFullscreen, toggleMute, toggleFullscreen, onFullscreenChange, attachFullscreenListener, detachFullscreenListener, takeScreenshot }
}
