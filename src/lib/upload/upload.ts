import type { IUploadItem } from '@/stores/temp'
import { arrayBufferToHex } from '../strutil'
import { getApiBaseUrl } from '../api/api'
import { aesEncrypt, bitArrayToUint8Array } from '../api/crypto'
import * as sjcl from 'sjcl'
import { uploadedChunksGQL } from '../api/query'
import { mergeChunksGQL } from '../api/mutation'
import apollo from '@/plugins/apollo'

const CHUNK_SIZE = 200 * 1024 * 1024 // 200MB
const UPDATE_INTERVAL = 500 // 500ms

export function getUploadUrl() {
  return `${getApiBaseUrl()}/upload`
}

export function getUploadChunkUrl() {
  return `${getApiBaseUrl()}/upload_chunk`
}

interface IUploadChunk {
  index: number
  chunk: Blob
}

// Unified progress update function
function updateUploadProgress(upload: IUploadItem, newSize: number, forceUpdate: boolean = false) {
  const currentTime = Date.now()
  const shouldUpdate = forceUpdate || !upload.lastUpdateTime || currentTime - upload.lastUpdateTime >= UPDATE_INTERVAL

  if (shouldUpdate) {
    const timeDiff = (currentTime - (upload.lastUpdateTime || currentTime)) / 1000 || 0.1
    const sizeDiff = newSize - (upload.lastUploadedSize || 0)

    // Update progress and speed
    upload.uploadedSize = newSize

    if (sizeDiff > 0 && timeDiff > 0) {
      upload.uploadSpeed = Math.round(sizeDiff / timeDiff)
    }

    upload.lastUpdateTime = currentTime
    upload.lastUploadedSize = newSize
  } else if (forceUpdate) {
    // Only update size when forced, not speed
    upload.uploadedSize = newSize
  }
}

// Initialize upload status
function initializeUpload(upload: IUploadItem) {
  upload.uploadSpeed = 0
  upload.lastUploadedSize = upload.uploadedSize || 0
  upload.lastUpdateTime = Date.now()
}

export async function getMD5Hash(data: ArrayBuffer) {
  // Check if crypto.subtle is available
  if (!crypto || !crypto.subtle) {
    // Fallback: use a simple hash based on data length and first few bytes
    const view = new Uint8Array(data)
    let hash = data.byteLength.toString(16)
    for (let i = 0; i < Math.min(16, view.length); i++) {
      hash += view[i].toString(16).padStart(2, '0')
    }
    return hash.padEnd(32, '0').substring(0, 32)
  }

  try {
    // Since Web Crypto API doesn't support MD5, we'll use SHA-256 as fallback
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    return arrayBufferToHex(hashBuffer).substring(0, 32) // Use first 32 chars as MD5-like hash
  } catch (error) {
    console.warn('Crypto API failed, using fallback hash:', error)
    // Fallback: use a simple hash based on data length and first few bytes
    const view = new Uint8Array(data)
    let hash = data.byteLength.toString(16)
    for (let i = 0; i < Math.min(16, view.length); i++) {
      hash += view[i].toString(16).padStart(2, '0')
    }
    return hash.padEnd(32, '0').substring(0, 32)
  }
}

export async function generateFileId(file: File) {
  try {
    const name = file.name
    const size = file.size
    const lastModified = file.lastModified

    // Read first 2MB of file content
    const chunkSize = 2 * 1024 * 1024 // 2MB
    const chunk = file.slice(0, Math.min(chunkSize, file.size))
    const chunkBuffer = await chunk.arrayBuffer()

    // Create string to hash
    const dataToHash = `${name}${size}${lastModified}`
    const textBuffer = new TextEncoder().encode(dataToHash)

    // Combine text and file content
    const combined = new Uint8Array(textBuffer.length + chunkBuffer.byteLength)
    combined.set(new Uint8Array(textBuffer), 0)
    combined.set(new Uint8Array(chunkBuffer), textBuffer.length)

    return await getMD5Hash(combined.buffer)
  } catch (error) {
    console.warn('Failed to generate file ID, using fallback:', error)
    // Fallback: use file metadata only
    const fallbackData = `${file.name}${file.size}${file.lastModified}`
    const textBuffer = new TextEncoder().encode(fallbackData)
    return await getMD5Hash(textBuffer.buffer as ArrayBuffer)
  }
}

export async function upload(upload: IUploadItem, replace: boolean) {
  const token = localStorage.getItem('auth_token') ?? ''
  const key = sjcl.codec.base64.toBits(token)

  // Initialize upload status
  initializeUpload(upload)

  try {
    if (upload.file.size > CHUNK_SIZE) {
      return await uploadWithChunks(upload, replace, key)
    } else {
      return await uploadDirect(upload, replace, key)
    }
  } catch (error: any) {
    if (error.name === 'AbortError' || upload.status === 'paused') {
      console.log('Upload was paused/aborted')
      return { error: 'Upload paused' }
    }
    throw error
  }
}

async function uploadDirect(upload: IUploadItem, replace: boolean, key: sjcl.BitArray) {
  try {
    const data = new FormData()
    const v = bitArrayToUint8Array(aesEncrypt(key, JSON.stringify({ dir: upload.dir, replace })))
    data.append('info', new Blob([v]))
    data.append('file', upload.file)

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()

      xhr.upload.addEventListener(
        'progress',
        (e) => {
          if (e.lengthComputable) {
            updateUploadProgress(upload, e.loaded)
          }
        },
        false
      )

      xhr.upload.addEventListener(
        'load',
        () => {
          upload.uploadedSize = upload.file.size
          upload.status = 'saving'
        },
        false
      )

      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
          if (xhr.status === 201) {
            upload.fileName = xhr.responseText
            upload.status = 'done'
            resolve({ fileName: xhr.responseText })
          } else if (xhr.status === 0) {
            resolve({ error: 'Upload aborted' })
          } else {
            upload.status = 'error'
            upload.error = xhr.responseText
            resolve({ error: xhr.responseText })
          }
        }
      }

      xhr.onerror = () => {
        upload.status = 'error'
        upload.error = 'Network error'
        resolve({ error: 'Network error' })
      }

      xhr.onabort = () => {
        console.log('Upload aborted')
        resolve({ error: 'Upload aborted' })
      }

      try {
        xhr.open('POST', getUploadUrl(), true)
        xhr.setRequestHeader('c-id', localStorage.getItem('client_id') ?? '')
        upload.xhr = xhr
        xhr.send(data)
      } catch (ex: any) {
        upload.status = 'error'
        upload.error = ex.message
        resolve({ error: ex.message })
      }
    })
  } catch (error: any) {
    upload.status = 'error'
    upload.error = error.message || 'Upload failed'
  }
}

async function uploadWithChunks(upload: IUploadItem, replace: boolean, key: sjcl.BitArray) {
  try {
    // Generate file ID
    if (!upload.fileId) {
      upload.fileId = await generateFileId(upload.file)
    }

    if (upload.status === 'paused') {
      return { error: 'Upload paused' }
    }

    upload.isChunked = true
    const totalChunks = Math.ceil(upload.file.size / CHUNK_SIZE)

    // Query uploaded chunks
    const uploadedChunks = await getUploadedChunks(upload.fileId)
    if (upload.status === 'paused') {
      return { error: 'Upload paused' }
    }

    upload.uploadedChunks = uploadedChunks

    // Upload missing chunks
    for (let i = 0; i < totalChunks; i++) {
      if (uploadedChunks.includes(i)) {
        // Update progress for already uploaded chunks
        const chunkEndSize = Math.min((i + 1) * CHUNK_SIZE, upload.file.size)
        updateUploadProgress(upload, chunkEndSize)
        continue
      }

      if (upload.status === 'canceled' || upload.status === 'paused') {
        return { error: 'Upload paused' }
      }

      const chunkData = createChunk(upload.file, i, CHUNK_SIZE)
      const success = await uploadChunkWithRetry(upload, chunkData, key)

      if (!success) {
        if (upload.status === 'paused') {
          return { error: 'Upload paused' }
        }
        upload.status = 'error'
        upload.error = `Failed to upload chunk ${i} after multiple retries`
        return
      }

      if (upload.status === 'paused') {
        return { error: 'Upload paused' }
      }

      // Update progress for completed chunks
      const chunkEndSize = chunkData.start + chunkData.chunk.size
      updateUploadProgress(upload, chunkEndSize, true) // Force update for completed chunks

      uploadedChunks.push(i)
      upload.uploadedChunks = [...uploadedChunks]
    }

    if (upload.status === 'canceled' || upload.status === 'paused') {
      return { error: 'Upload paused' }
    }

    // Merge chunks
    upload.status = 'saving'
    const filePath = upload.dir.endsWith('/') ? upload.dir + upload.file.name : upload.dir + '/' + upload.file.name

    const result = await apollo.a.mutate({
      mutation: mergeChunksGQL,
      variables: {
        fileId: upload.fileId,
        totalChunks,
        path: filePath,
        replace: replace,
      },
    })

    if (result?.data?.mergeChunks) {
      upload.fileName = result.data.mergeChunks
      upload.status = 'done'
    } else {
      upload.status = 'error'
      upload.error = 'Failed to merge chunks'
    }
  } catch (error: any) {
    if (error.name === 'AbortError' || upload.status === 'paused') {
      return { error: 'Upload paused' }
    }
    upload.status = 'error'
    upload.error = error.message || 'Upload failed'
  }
}

// Get list of uploaded chunks
async function getUploadedChunks(fileId: string): Promise<number[]> {
  try {
    const result = await apollo.a.query({
      query: uploadedChunksGQL,
      variables: { fileId },
      fetchPolicy: 'network-only',
    })
    return result.data?.uploadedChunks ? [...result.data.uploadedChunks] : []
  } catch (error) {
    console.error('Failed to query uploaded chunks:', error)
    return []
  }
}

// Create chunk data
function createChunk(file: File, index: number, chunkSize: number): IUploadChunk & { start: number; end: number } {
  const start = index * chunkSize
  const end = Math.min(start + chunkSize, file.size)
  return {
    index,
    chunk: file.slice(start, end),
    start,
    end,
  }
}

async function uploadChunkWithRetry(upload: IUploadItem, chunkData: IUploadChunk & { start: number; end: number }, key: sjcl.BitArray, maxRetries: number = 3): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    if (upload.status === 'canceled' || upload.status === 'paused') {
      return false
    }

    try {
      const success = await uploadChunk(upload, chunkData, key)
      if (success) {
        return true
      }

      if (upload.status === 'paused') {
        return false
      }

      console.warn(`Chunk ${chunkData.index} upload failed on attempt ${attempt}`)

      // Wait before retry
      if (attempt < maxRetries) {
        await waitWithPauseCheck(upload, Math.min(1000 * Math.pow(2, attempt - 1), 5000))
      }
    } catch (error: any) {
      if (upload.status === 'paused') {
        return false
      }

      console.warn(`Chunk ${chunkData.index} upload error on attempt ${attempt}:`, error.message)

      if (attempt < maxRetries) {
        await waitWithPauseCheck(upload, Math.min(1000 * Math.pow(2, attempt - 1), 5000))
      }
    }
  }

  console.error(`Failed to upload chunk ${chunkData.index} after ${maxRetries} attempts`)
  return false
}

// Interruptible wait function
async function waitWithPauseCheck(upload: IUploadItem, delay: number): Promise<void> {
  const startTime = Date.now()
  while (Date.now() - startTime < delay) {
    if (upload.status === 'paused') {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
}

async function uploadChunk(upload: IUploadItem, chunkData: IUploadChunk & { start: number; end: number }, key: sjcl.BitArray): Promise<boolean> {
  return new Promise((resolve) => {
    const data = new FormData()
    const info = JSON.stringify({
      fileId: upload.fileId,
      index: chunkData.index,
    })
    const v = bitArrayToUint8Array(aesEncrypt(key, info))
    data.append('info', new Blob([v]))
    data.append('file', chunkData.chunk, upload.file.name)

    const xhr = new XMLHttpRequest()
    let excludeSize = 0

    xhr.upload.addEventListener(
      'progress',
      (e) => {
        if (e.lengthComputable) {
          if (excludeSize === 0) {
            excludeSize = e.total - chunkData.chunk.size
          }
          if (e.loaded > excludeSize) {
            const uploadedInThisChunk = e.loaded - excludeSize
            const totalUploaded = chunkData.start + uploadedInThisChunk
            updateUploadProgress(upload, totalUploaded)
          }
        }
      },
      false
    )

    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        if (xhr.status === 201) {
          resolve(true)
        } else if (xhr.status === 0) {
          console.log(`Chunk ${chunkData.index} upload was aborted`)
          resolve(false)
        } else {
          console.warn(`Chunk ${chunkData.index} upload failed with status ${xhr.status}`)
          resolve(false)
        }
      }
    }

    xhr.onerror = () => {
      console.warn(`Chunk ${chunkData.index} upload network error`)
      resolve(false)
    }

    xhr.onabort = () => {
      console.log(`Chunk ${chunkData.index} upload was aborted`)
      resolve(false)
    }

    try {
      xhr.open('POST', getUploadChunkUrl(), true)
      xhr.setRequestHeader('c-id', localStorage.getItem('client_id') ?? '')
      xhr.send(data)
      upload.xhr = xhr
    } catch (ex: any) {
      console.warn(`Chunk ${chunkData.index} upload exception:`, ex.message)
      resolve(false)
    }
  })
}
