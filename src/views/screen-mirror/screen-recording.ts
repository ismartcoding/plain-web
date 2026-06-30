import { ref, type Ref } from 'vue'
import { download } from '@/lib/api/file'
import toast from '@/components/toaster'
import { useI18n } from 'vue-i18n'

/**
 * Client-side screen recording composable.
 * Captures the canvas + audio via canvas.captureStream() and downloads the
 * recording as a WebM/MP4 file on the PC.
 */
export function useScreenRecording(canvasRef: Ref<HTMLCanvasElement | undefined>) {
  const { t } = useI18n()
  const recording = ref(false)
  const recordingTime = ref('00:00')

  let mediaRecorder: MediaRecorder | null = null
  let recordedChunks: Blob[] = []
  let timerInterval: ReturnType<typeof setInterval> | null = null
  let startTime = 0

  const updateTimer = () => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000)
    const minutes = String(Math.floor(elapsed / 60)).padStart(2, '0')
    const seconds = String(elapsed % 60).padStart(2, '0')
    recordingTime.value = `${minutes}:${seconds}`
  }

  const startRecording = () => {
    const canvas = canvasRef.value
    if (!canvas || canvas.width === 0 || canvas.height === 0) {
      toast(t('recording_no_stream'), 'error')
      return
    }

    const stream = (canvas as HTMLCanvasElement).captureStream(30)

    const mimeTypes = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4',
    ]

    let selectedMime = ''
    for (const mime of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mime)) {
        selectedMime = mime
        break
      }
    }

    if (!selectedMime) {
      toast(t('recording_not_supported'), 'error')
      return
    }

    recordedChunks = []

    try {
      mediaRecorder = new MediaRecorder(stream, {
        mimeType: selectedMime,
        videoBitsPerSecond: 5_000_000,
      })
    } catch {
      toast(t('recording_not_supported'), 'error')
      return
    }

    mediaRecorder.ondataavailable = (event: BlobEvent) => {
      if (event.data.size > 0) {
        recordedChunks.push(event.data)
      }
    }

    mediaRecorder.onstop = () => {
      if (recordedChunks.length === 0) return

      const blob = new Blob(recordedChunks, { type: selectedMime })
      const url = URL.createObjectURL(blob)

      const ext = selectedMime.startsWith('video/mp4') ? 'mp4' : 'webm'
      const d = new Date()
      const fileName =
        'screen-recording-' +
        [d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()].join('') +
        '.' + ext

      download(url, fileName)

      setTimeout(() => URL.revokeObjectURL(url), 10_000)
      recordedChunks = []
    }

    mediaRecorder.onerror = () => {
      recording.value = false
      clearTimer()
      toast(t('recording_failed'), 'error')
    }

    mediaRecorder.start(1000)
    recording.value = true
    startTime = Date.now()
    recordingTime.value = '00:00'
    timerInterval = setInterval(updateTimer, 1000)
  }

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop()
    }
    mediaRecorder = null
    recording.value = false
    clearTimer()
  }

  const clearTimer = () => {
    if (timerInterval) {
      clearInterval(timerInterval)
      timerInterval = null
    }
  }

  const toggleRecording = () => {
    if (recording.value) {
      stopRecording()
    } else {
      startRecording()
    }
  }

  return {
    recording,
    recordingTime,
    toggleRecording,
    stopRecording,
  }
}
