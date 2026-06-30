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

  const toggleFullscreen = () => {
    const wrapper = document.querySelector('.video-wrapper')
    if (!wrapper) return
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      wrapper.requestFullscreen()
    }
  }

  const onFullscreenChange = () => {
    isFullscreen.value = !!document.fullscreenElement
  }

  const takeScreenshot = () => {
    const canvas = canvasRef.value
    if (!canvas) return
    const d = new Date()
    const fileName = 'screenshot-' + [d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds()].join('') + '.png'
    download(canvas.toDataURL(), fileName)
  }

  return { muted, isFullscreen, toggleMute, toggleFullscreen, onFullscreenChange, takeScreenshot }
}
