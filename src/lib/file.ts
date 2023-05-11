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
  return photoExtensions.some((it) => name.endsWith(it))
}

export function isVideo(name: string) {
  return videoExtensions.some((it) => name.endsWith(it))
}

export function isAudio(name: string) {
  return audioExtensions.some((it) => name.endsWith(it))
}

export function isRaw(name: string) {
  return rawExtensions.some((it) => name.endsWith(it))
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

export const getFileName = (path: string) => path.split(/[\\\/]/).pop()
