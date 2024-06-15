import type { IData } from './interfaces'

const photoExtensions = ['.jpg', '.png', '.jpeg', '.bmp', '.webp', '.heic', '.heif', '.apng', '.avif', '.gif', '.tiff', '.tif', '.svg']
const videoExtensions = ['.mp4', '.mkv', '.webm', '.avi', '.3gp', '.mov', '.m4v', '.3gpp']
const audioExtensions = ['.mp3', '.wav', '.wma', '.ogg', '.m4a', '.opus', '.flac', '.aac']
const rawExtensions = ['.dng', '.orf', '.nef', '.arw', '.rw2', '.cr2', '.cr3']

export interface IFile extends IData {
  fileId: string
  path: string
  name: string
  isDir: boolean
  updatedAt: string
  createdAt: string
  extension: string
  size: number
  panel?: FilePanel
}

export function isImage(name: string) {
  const v = name.toLowerCase()
  return photoExtensions.some((it) => v.endsWith(it))
}

export function isSvg(name: string) {
  const v = name.toLowerCase()
  return v.endsWith('.svg')
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
  return isImage(name) || isVideo(name) || isAudio(name)
}

export function canOpenInBrowser(name: string) {
  return ['.txt', '.pdf', '.md'].some((it) => name.endsWith(it))
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

export function getSortItems() {
  return [
    { label: 'sort_by.date_asc', value: 'DATE_ASC' },
    { label: 'sort_by.date_desc', value: 'DATE_DESC' },
    { label: 'sort_by.size_asc', value: 'SIZE_ASC' },
    { label: 'sort_by.size_desc', value: 'SIZE_DESC' },
    { label: 'sort_by.name_asc', value: 'NAME_ASC' },
    { label: 'sort_by.name_desc', value: 'NAME_DESC' },
  ]
}

export async function getVideoData(videoFile: File): Promise<{ src: string; duration: number; thumbnail: string; width: number; height: number }> {
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
        width: video.videoWidth,
        height: video.videoHeight,
      })
    }
    video.onerror = () => {
      resolve({ src, duration: 0, thumbnail: '', width: 0, height: 0 })
    }
  })
}

export async function getImageData(file: File): Promise<{ src: string; width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image()
    const src = URL.createObjectURL(file)
    img.onload = function () {
      URL.revokeObjectURL(src)
      resolve({
        src,
        width: img.width,
        height: img.height,
      })
    }
    img.src = src
    img.onerror = () => {
      resolve({ src, width: 0, height: 0 })
    }
  })
}

export function getDirFromPath(path: string) {
  const index = path.lastIndexOf('/')
  return index === -1 ? '' : path.substring(0, index)
}
