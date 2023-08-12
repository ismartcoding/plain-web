import type { ISelectable } from './interfaces'

const photoExtensions = ['.jpg', '.png', '.jpeg', '.bmp', '.webp', '.heic', '.heif', '.apng', '.avif', '.gif']
const videoExtensions = ['.mp4', '.mkv', '.webm', '.avi', '.3gp', '.mov', '.m4v', '.3gpp']
const audioExtensions = ['.mp3', '.wav', '.wma', '.ogg', '.m4a', '.opus', '.flac', '.aac']
const rawExtensions = ['.dng', '.orf', '.nef', '.arw', '.rw2', '.cr2', '.cr3']

export interface IFile extends ISelectable {
  fileId: string
  path: string
  name: string
  isDir: boolean
  checked: boolean
  updatedAt: string
  size: number
}

export function isImage(name: string) {
  const v = name.toLowerCase()
  return photoExtensions.some((it) => v.endsWith(it))
}

export function isVideo(name: string) {
  const v = name.toLowerCase()
  return videoExtensions.some((it) => v.endsWith(it))
}

export function isAudio(name: string) {
  const v = name.toLowerCase()
  return audioExtensions.some((it) => v.endsWith(it))
}

export function isRaw(name: string) {
  const v = name.toLowerCase()
  return rawExtensions.some((it) => v.endsWith(it))
}

export function canView(name: string) {
  return isImage(name) || isVideo(name) || isAudio(name) || isRaw(name)
}

export class FilePanel {
  dir!: string
  items: IFile[] = []

  constructor(dir: string, items: IFile[]) {
    this.dir = dir
    this.items = items
  }

  deleteItem(path: string) {
    const index = this.items.findIndex((it) => this.inPath(it.path, path))
    if (index !== -1) {
      this.items.splice(index, 1)
    }
  }

  inPath(srcPath: string, path: string) {
    return (srcPath + '/').startsWith(path + '/')
  }

  rename(path: string, oldName: string, newName: string) {
    const f = this.items.find((it) => this.inPath(it.path, path))
    if (f) {
      if (f.path === path) {
        f.path = f.path.replace('/' + oldName, '/' + newName)
        f.name = newName
      } else {
        f.path = f.path.replace('/' + oldName + '/', '/' + newName + '/')
      }
    }
    if (this.inPath(this.dir, path)) {
      if (this.dir === path) {
        this.dir = this.dir.replace('/' + oldName, '/' + newName)
      } else {
        this.dir = this.dir.replace('/' + oldName + '/', '/' + newName + '/')
      }
    }
  }
}

export async function getVideoData(videoFile: File): Promise<{ src: string; duration: number; thumbnail: string }> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    const canvas = document.createElement('canvas')

    const src = URL.createObjectURL(videoFile)
    video.src = src
    video.play()

    video.onloadeddata = async () => {
      const squareSize = Math.min(video.videoWidth, video.videoHeight)
      const cropX = (video.videoWidth - squareSize) / 2
      const cropY = (video.videoHeight - squareSize) / 2

      canvas.width = 200 // Set the desired width
      canvas.height = 200 // Set the desired height
      const canvasContext = canvas.getContext('2d')
      canvasContext.drawImage(video, cropX, cropY, squareSize, squareSize, 0, 0, canvas.width, canvas.height)

      const thumbnail = canvas.toDataURL()

      // Pause the video and clean up
      video.pause()
      video.currentTime = 0

      URL.revokeObjectURL(src)
      video.remove()
      canvas.remove()

      resolve({
        src,
        duration: Math.round(video.duration),
        thumbnail,
      })
    }
  })
}

export const getFileName = (path: string) => path.split(/[\\\/]/).pop()
