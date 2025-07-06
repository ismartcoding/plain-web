import { arrayBufferToHex } from '../strutil'
import { getApiBaseUrl } from './api'
import { chachaEncrypt, bitArrayToBase64 } from './crypto'
import * as sjcl from 'sjcl'

declare global {
  interface Window {
    fileIdMap: Map<string, string>
  }
}

export function notId(id: string) {
  const l = id.toLowerCase()
  return l.startsWith('https://') || l.startsWith('http://') || l.startsWith('blob:')
}

export function getFileUrl(id: string, query: string = '') {
  if (notId(id)) {
    return id
  }

  return `${getApiBaseUrl()}/fs?id=${encodeURIComponent(id)}${query}`
}

export function getFileUrlByPath(key: sjcl.BitArray | null, path: string) {
  if (!path || !key) {
    return ''
  }
  return getFileUrl(getFileId(key, path))
}

export function download(url: string, name: string) {
  const link = document.createElement('a')
  if (typeof link.download === 'string') {
    link.href = url
    link.download = name

    //Firefox requires the link to be in the body
    document.body.appendChild(link)

    link.click()

    //remove the link when done
    document.body.removeChild(link)
  } else {
    window.open(url)
  }
}

export function downloadFromString(content: string, mimeType: string, fileName: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  download(url, fileName)
}

export function getFileName(path: string) {
  return path.substring(path.lastIndexOf('/') + 1)
}

export async function getFileHash(f: File) {
  return arrayBufferToHex(await crypto.subtle.digest('SHA-256', await f.arrayBuffer()))
}

export function tokenToKey(token: string) {
  return sjcl.codec.base64.toBits(token)
}

export function encryptUrlParams(key: sjcl.BitArray | null, params: string) {
  if (!key) {
    return ''
  }

  const enc = chachaEncrypt(key, params)
  return bitArrayToBase64(enc)
}

export function getFinalPath(externalFilesDir: string, path: string) {
  if (path.startsWith('app://')) {
    return externalFilesDir + '/' + path.replace('app://', '')
  }

  return path
}

export function getFileId(key: sjcl.BitArray | null, path: string, mediaId: string = '') {
  if (!path || !key) {
    return ''
  }

  const loPath = path.toLowerCase()
  if (loPath.startsWith('https://') || loPath.startsWith('http://')) {
    return path
  }

  const fileIdMap = window.fileIdMap || new Map<string, string>()
  if (fileIdMap.has(path)) {
    return fileIdMap.get(path) ?? ''
  }

  const enc = chachaEncrypt(key, mediaId ? JSON.stringify({ path, mediaId }) : path)
  const id = bitArrayToBase64(enc)
  fileIdMap.set(path, id)
  return id
}

export function getFileExtension(filePath: string) {
  const lastDotIndex = filePath.lastIndexOf('.')
  if (lastDotIndex === -1) {
    return ''
  }
  // fix hidden file extension
  const lastSlashIndex = filePath.lastIndexOf('/')
  if (lastSlashIndex > lastDotIndex) {
    return ''
  }

  return filePath.substring(lastDotIndex + 1).toLowerCase()
}
