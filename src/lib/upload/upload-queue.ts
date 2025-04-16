import type { IUploadItem } from '@/stores/temp'
import { upload } from './upload'
import emitter from '@/plugins/eventbus'

// Upload queue management interfaces and types
export interface IUploadTask {
  id: string
  upload: IUploadItem
  replace: boolean
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed'
  aborted?: boolean
}

class UploadQueue {
  private queue: IUploadTask[] = []
  private running: Map<string, IUploadTask> = new Map()
  private readonly maxConcurrent = 10

  addTask(upload: IUploadItem, replace: boolean): string {
    const task: IUploadTask = {
      id: upload.id,
      upload,
      replace,
      status: 'pending',
    }

    this.queue.push(task)
    this.processQueue()
    return task.id
  }

  pauseTask(taskId: string): boolean {
    const task = this.findTask(taskId)
    if (!task) {
      console.warn(`pauseTask: Task ${taskId} not found`)
      return false
    }

    console.log(`pauseTask: Attempting to pause task ${taskId}, current status: ${task.status}`)

    if (task.status === 'running') {
      task.status = 'paused'
      task.upload.status = 'paused'
      task.aborted = true

      // Force abort current xhr if exists
      if (task.upload.xhr) {
        console.log(`pauseTask: Aborting xhr for task ${taskId}`)
        try {
          task.upload.xhr.abort()
        } catch (error) {
          console.warn(`pauseTask: Error aborting xhr for task ${taskId}:`, error)
        }
      } else {
        console.warn(`pauseTask: No xhr found for running task ${taskId}`)
      }

      this.running.delete(taskId)
      this.processQueue()
      console.log(`pauseTask: Task ${taskId} paused successfully`)
    } else if (task.status === 'pending') {
      task.status = 'paused'
      task.upload.status = 'paused'
      console.log(`pauseTask: Pending task ${taskId} paused successfully`)
    } else {
      console.warn(`pauseTask: Task ${taskId} cannot be paused, current status: ${task.status}`)
      return false
    }
    return true
  }

  resumeTask(taskId: string): boolean {
    const task = this.findTask(taskId)
    if (!task || task.status !== 'paused') return false

    task.status = 'pending'
    task.upload.status = 'uploading'
    task.aborted = false
    this.processQueue()
    return true
  }

  retryTask(taskId: string): boolean {
    const task = this.findTask(taskId)
    if (!task || task.status !== 'failed') return false

    task.status = 'pending'
    task.upload.status = 'uploading'
    task.upload.error = ''
    task.upload.uploadedSize = 0
    task.upload.uploadSpeed = 0
    task.upload.lastUploadedSize = 0
    task.upload.lastUpdateTime = undefined
    task.aborted = false
    this.processQueue()
    return true
  }

  removeTask(taskId: string): boolean {
    const task = this.findTask(taskId)
    if (!task) return false

    if (task.status === 'running') {
      task.aborted = true
      task.upload.xhr?.abort()
      this.running.delete(taskId)
    }

    this.queue = this.queue.filter((t) => t.id !== taskId)
    task.upload.status = 'canceled'
    this.processQueue()
    return true
  }

  getQueueStatus() {
    return {
      pending: this.queue.filter((t) => t.status === 'pending').length,
      running: this.running.size,
      paused: this.queue.filter((t) => t.status === 'paused').length,
      total: this.queue.length,
    }
  }

  private findTask(taskId: string): IUploadTask | undefined {
    return this.queue.find((t) => t.id === taskId) || this.running.get(taskId)
  }

  private processQueue(): void {
    // Start new tasks if we have capacity
    while (this.running.size < this.maxConcurrent) {
      const nextTask = this.queue.find((t) => t.status === 'pending')
      if (!nextTask) break

      this.executeTask(nextTask)
    }
  }

  private async executeTask(task: IUploadTask): Promise<void> {
    task.status = 'running'
    task.upload.status = 'uploading'
    task.aborted = false
    this.running.set(task.id, task)

    try {
      const result = await upload(task.upload, task.replace)

      // Check if task was aborted during upload
      if (task.aborted) {
        return
      }

      if (result?.error) {
        task.status = 'failed'
        task.upload.status = 'error'
      } else {
        task.status = 'completed'
        task.upload.status = 'done'
        emitter.emit('upload_task_done', task.upload)
      }
    } catch (error: any) {
      // Check if task was aborted during upload
      if (task.aborted) {
        return
      }

      task.status = 'failed'
      task.upload.status = 'error'
      task.upload.error = error.message || 'Upload failed'
    } finally {
      this.running.delete(task.id)
      this.processQueue()
    }
  }
}

const uploadQueue = new UploadQueue()

export function addUploadTask(upload: IUploadItem, replace: boolean): string {
  return uploadQueue.addTask(upload, replace)
}

export function pauseUpload(taskId: string): boolean {
  return uploadQueue.pauseTask(taskId)
}

export function resumeUpload(taskId: string): boolean {
  return uploadQueue.resumeTask(taskId)
}

export function retryUpload(taskId: string): boolean {
  return uploadQueue.retryTask(taskId)
}

export function removeUpload(taskId: string): boolean {
  return uploadQueue.removeTask(taskId)
}

export function getUploadQueueStatus() {
  return uploadQueue.getQueueStatus()
}
