import { ref, computed, type Ref } from 'vue'
import { download } from '@/lib/api/file'

export function useScreenMirrorMedia(videoRef: Ref<HTMLVideoElement | undefined>) {
  const paused = ref(false)
  const muted = ref(true)
  const isFullscreen = ref(false)

  const togglePlay = () => {
    const video = videoRef.value
    if (!video) return
    if (video.paused) {
      video.play().catch(() => undefined)
      paused.value = false
    } else {
      video.pause()
      paused.value = true
    }
  }

  const toggleMute = () => {
    const video = videoRef.value
    if (!video) return
    video.muted = !video.muted
    muted.value = video.muted
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
    const video = videoRef.value
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    }
    const d = new Date()
    const fileName = 'screenshot-' + [d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds()].join('') + '.png'
    download(canvas.toDataURL(), fileName)
  }

  return { paused, muted, isFullscreen, togglePlay, toggleMute, toggleFullscreen, onFullscreenChange, takeScreenshot }
}
