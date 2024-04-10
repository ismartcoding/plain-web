import type { IUploadItem } from '@/stores/temp'
import { arrayBufferToHex } from '../strutil'
import { getApiBaseUrl } from './api'
import { aesEncrypt, bitArrayToBase64, bitArrayToUint8Array } from './crypto'
import * as sjcl from 'sjcl'

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

export function tokenToKey(token: string) {
  return sjcl.codec.base64.toBits(token)
}

export function encryptUrlParams(key: sjcl.BitArray | null, params: string) {
  if (!key) {
    return ''
  }

  const enc = aesEncrypt(key, params)
  return bitArrayToBase64(enc)
}

export function getFinalPath(externalFilesDir: string, path: string) {
  if (path.startsWith('app://')) {
    return externalFilesDir + '/' + path.replace('app://', '')
  }

  return path
}

export function getFileId(key: sjcl.BitArray | null, path: string) {
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

  const enc = aesEncrypt(key, path)
  const id = bitArrayToBase64(enc)
  fileIdMap.set(path, id)
  return id
}

export async function upload(upload: IUploadItem, replace: boolean) {
  const token = localStorage.getItem('auth_token') ?? ''
  const key = sjcl.codec.base64.toBits(token)

  const chunkSize = 1000 * 1000 * 512 // 512MB chunks

  async function sendChunk(offset: number, index: number, total: number) {
    const chunkEnd = Math.min(offset + chunkSize, upload.file.size)
    const uploadingFileSize = chunkEnd - offset
    const data = new FormData()
    const v = bitArrayToUint8Array(aesEncrypt(key, JSON.stringify({ dir: upload.dir, replace, index, size: uploadingFileSize, total: total })))
    data.append('info', new Blob([v]))
    const slice = upload.file.slice(offset, chunkEnd)
    data.append('file', new File([slice], offset > 0 ? upload.fileName : upload.file.name))

    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest()

      let excludeSize = 0
      xhr.upload.addEventListener(
        'progress',
        function (e) {
          if (e.lengthComputable) {
            if (excludeSize === 0) {
              excludeSize = e.total - uploadingFileSize
            }
            if (e.loaded > excludeSize) {
              upload.uploadedSize = offset + e.loaded - excludeSize
            }
          }
        },
        false
      )

      xhr.upload.addEventListener(
        'load',
        function () {
          if (index === total - 1) {
            upload.uploadedSize = upload.file.size
            upload.status = 'saving'
          }
        },
        false
      )

      xhr.onreadystatechange = function () {
        console.log(xhr)
        if (xhr.readyState === 4) {
          if (xhr.status === 201) {
            resolve({ fileName: xhr.responseText })
          } else {
            resolve({ error: xhr.responseText })
          }
        }
      }

      try {
        xhr.open('POST', getUploadUrl(), true)
        xhr.setRequestHeader('c-id', localStorage.getItem('client_id') ?? '')
        xhr.send(data)
        upload.xhr = xhr
      } catch (ex: any) {
        resolve({ error: ex.message })
      }
    })
  }

  try {
    let offset = 0
    const offsets = []
    while (offset < upload.file.size) {
      offsets.push(offset)
      offset += chunkSize
    }

    let retry = 3
    for (let i = 0; i < offsets.length; i++) {
      do {
        const r: any = await sendChunk(offsets[i], i, offsets.length)
        if (upload.status === 'canceled') {
          break
        }
        if (r.error) {
          if (retry === 0) {
            upload.status = 'error'
            upload.error = r.error
          }
          retry--
        } else {
          upload.fileName = r.fileName
          break
        }
      } while (retry >= 0)
    }

    upload.status = 'done'
  } catch (error: any) {
    upload.status = 'error'
    upload.error = error
  }
}
