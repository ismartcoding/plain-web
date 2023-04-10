import type { IUploadItem } from '@/stores/temp'
import { arrayBufferToHex } from '../strutil'
import { getApiBaseUrl } from './api'
import { aesEncrypt, bitArrayToBase64, bitArrayToUint8Array } from './crypto'
import * as sjcl from 'sjcl'

export function getFileUrl(id: string) {
  const l = id.toLowerCase()
  if (l.startsWith('https://') || l.startsWith('http://')) {
    return id
  }
  return `${getApiBaseUrl()}/fs?id=${encodeURIComponent(id)}`
}

export async function getFileUrlByPath(token: string, path: string) {
  if (!path) {
    return ''
  }
  return getFileUrl(await getFileId(token, path))
}

export function getUploadUrl() {
  return `${getApiBaseUrl()}/upload`
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

export async function getFileId(token: string, path: string) {
  if (!path) {
    return ''
  }

  const loPath = path.toLowerCase()
  if (loPath.startsWith('https://') || loPath.startsWith('http://')) {
    return path
  }

  const key = sjcl.codec.base64.toBits(token)
  const enc = aesEncrypt(key, path)
  return bitArrayToBase64(enc)
}

export async function upload(upload: IUploadItem) {
  const data = new FormData()
  const token = localStorage.getItem('auth_token') ?? ''
  const key = sjcl.codec.base64.toBits(token)
  const v = bitArrayToUint8Array(aesEncrypt(key, JSON.stringify({ dir: upload.dir })))
  data.append('info', new Blob([v]))
  data.append('file', upload.file)

  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest()

    let excludeSize = 0
    xhr.upload.addEventListener(
      'progress',
      function (e) {
        if (e.lengthComputable) {
          if (excludeSize === 0) {
            excludeSize = e.total - upload.file.size
          }
          if (e.loaded > excludeSize) {
            upload.uploadedSize = e.loaded - excludeSize
          }
        }
      },
      false
    )

    xhr.upload.addEventListener(
      'load',
      function () {
        upload.uploadedSize = upload.file.size
        upload.status = 'saving'
      },
      false
    )

    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        if (xhr.status === 201) {
          upload.status = 'done'
        } else {
          upload.status = 'error'
          upload.error = xhr.responseText
        }
        resolve(xhr.responseText)
      }
    }

    xhr.open('POST', getUploadUrl(), true)
    xhr.setRequestHeader('c-id', localStorage.getItem('client_id') ?? '')
    xhr.send(data)
    upload.xhr = xhr
  })
}
