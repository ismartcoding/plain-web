import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Tests for chunk creation logic and progress tracking.
 * We test the internal helpers by re-implementing the pure logic
 * (since they're not exported) to verify correctness.
 */

const CHUNK_SIZE = 5 * 1024 * 1024 // 5MB — must match upload.ts

describe('Chunk creation logic', () => {
  function createChunk(fileSize: number, index: number, chunkSize: number) {
    const start = index * chunkSize
    const end = Math.min(start + chunkSize, fileSize)
    return { index, start, end, size: end - start }
  }

  it('creates correct chunk for first chunk', () => {
    const chunk = createChunk(10 * 1024 * 1024, 0, CHUNK_SIZE)
    expect(chunk.start).toBe(0)
    expect(chunk.end).toBe(CHUNK_SIZE)
    expect(chunk.size).toBe(CHUNK_SIZE)
  })

  it('creates correct chunk for middle chunk', () => {
    const chunk = createChunk(20 * 1024 * 1024, 2, CHUNK_SIZE)
    expect(chunk.start).toBe(10 * 1024 * 1024)
    expect(chunk.end).toBe(15 * 1024 * 1024)
    expect(chunk.size).toBe(CHUNK_SIZE)
  })

  it('creates correct last chunk (smaller than CHUNK_SIZE)', () => {
    const fileSize = 12 * 1024 * 1024 // 12MB → 3 chunks: 5MB, 5MB, 2MB
    const totalChunks = Math.ceil(fileSize / CHUNK_SIZE)
    expect(totalChunks).toBe(3)

    const lastChunk = createChunk(fileSize, 2, CHUNK_SIZE)
    expect(lastChunk.start).toBe(10 * 1024 * 1024)
    expect(lastChunk.end).toBe(12 * 1024 * 1024)
    expect(lastChunk.size).toBe(2 * 1024 * 1024)
  })

  it('handles file exactly equal to chunk size', () => {
    const fileSize = CHUNK_SIZE
    const totalChunks = Math.ceil(fileSize / CHUNK_SIZE)
    expect(totalChunks).toBe(1)

    const chunk = createChunk(fileSize, 0, CHUNK_SIZE)
    expect(chunk.size).toBe(CHUNK_SIZE)
  })

  it('handles file slightly larger than chunk size', () => {
    const fileSize = CHUNK_SIZE + 1
    const totalChunks = Math.ceil(fileSize / CHUNK_SIZE)
    expect(totalChunks).toBe(2)

    const chunk0 = createChunk(fileSize, 0, CHUNK_SIZE)
    const chunk1 = createChunk(fileSize, 1, CHUNK_SIZE)
    expect(chunk0.size).toBe(CHUNK_SIZE)
    expect(chunk1.size).toBe(1)
    expect(chunk0.size + chunk1.size).toBe(fileSize)
  })

  it('all chunks sum to file size', () => {
    const fileSize = 63071779 // ~60MB real file size from test data
    const totalChunks = Math.ceil(fileSize / CHUNK_SIZE)
    let totalSize = 0
    for (let i = 0; i < totalChunks; i++) {
      const chunk = createChunk(fileSize, i, CHUNK_SIZE)
      totalSize += chunk.size
    }
    expect(totalSize).toBe(fileSize)
  })
})

describe('Chunk verification logic', () => {
  /**
   * Mirrors getUploadedChunks() validation logic from upload.ts
   */
  function verifyChunks(
    serverChunks: string[],
    fileSize: number,
    totalChunks: number,
    chunkSize: number
  ): { verified: number[]; rejected: number[] } {
    const verified: number[] = []
    const rejected: number[] = []

    for (const entry of serverChunks) {
      const parts = entry.split(':')
      const index = parseInt(parts[0], 10)
      const serverSize = parts.length > 1 ? parseInt(parts[1], 10) : -1
      if (isNaN(index) || index < 0 || index >= totalChunks) continue

      const chunkStart = index * chunkSize
      const expectedSize = Math.min(chunkSize, fileSize - chunkStart)
      if (serverSize > 0 && serverSize !== expectedSize) {
        rejected.push(index)
        continue
      }
      verified.push(index)
    }
    return { verified, rejected }
  }

  it('accepts chunks with correct sizes', () => {
    const fileSize = 12 * 1024 * 1024
    const totalChunks = 3
    const result = verifyChunks(
      [`0:${CHUNK_SIZE}`, `1:${CHUNK_SIZE}`, `2:${2 * 1024 * 1024}`],
      fileSize,
      totalChunks,
      CHUNK_SIZE
    )
    expect(result.verified).toEqual([0, 1, 2])
    expect(result.rejected).toEqual([])
  })

  it('rejects chunks with size mismatch (partial write)', () => {
    const fileSize = 12 * 1024 * 1024
    const totalChunks = 3
    const result = verifyChunks(
      [`0:${CHUNK_SIZE}`, `1:4798891`, `2:${2 * 1024 * 1024}`],
      fileSize,
      totalChunks,
      CHUNK_SIZE
    )
    expect(result.verified).toEqual([0, 2])
    expect(result.rejected).toEqual([1])
  })

  it('rejects chunk with wrong last-chunk size', () => {
    const fileSize = 12 * 1024 * 1024 // last chunk should be 2MB
    const totalChunks = 3
    const result = verifyChunks(
      [`2:${CHUNK_SIZE}`], // last chunk claims to be 5MB
      fileSize,
      totalChunks,
      CHUNK_SIZE
    )
    expect(result.verified).toEqual([])
    expect(result.rejected).toEqual([2])
  })

  it('ignores chunks with out-of-range index', () => {
    const result = verifyChunks(
      ['5:5242880', '-1:5242880', 'abc:5242880'],
      12 * 1024 * 1024,
      3,
      CHUNK_SIZE
    )
    expect(result.verified).toEqual([])
    expect(result.rejected).toEqual([])
  })

  it('handles empty server response', () => {
    const result = verifyChunks([], 12 * 1024 * 1024, 3, CHUNK_SIZE)
    expect(result.verified).toEqual([])
    expect(result.rejected).toEqual([])
  })
})

describe('Parallel workers logic', () => {
  it('cursor-based scheduling covers all chunks', async () => {
    const pendingIndices = [0, 2, 5, 7, 11]
    let cursor = 0
    const processed: number[] = []

    const worker = async () => {
      while (cursor < pendingIndices.length) {
        const myIdx = cursor++
        if (myIdx >= pendingIndices.length) return
        processed.push(pendingIndices[myIdx])
        // Simulate async work
        await new Promise((r) => setTimeout(r, 1))
      }
    }

    // 3 parallel workers
    await Promise.all([worker(), worker(), worker()])

    // All chunks should be processed, each exactly once
    expect(processed.sort((a, b) => a - b)).toEqual([0, 2, 5, 7, 11])
  })

  it('handles fewer chunks than workers', async () => {
    const pendingIndices = [3]
    let cursor = 0
    const processed: number[] = []

    const worker = async () => {
      while (cursor < pendingIndices.length) {
        const myIdx = cursor++
        if (myIdx >= pendingIndices.length) return
        processed.push(pendingIndices[myIdx])
      }
    }

    await Promise.all([worker(), worker(), worker()])
    expect(processed).toEqual([3])
  })
})

describe('XHR tracking (xhrs Set)', () => {
  it('tracks multiple XHRs and aborts all on cancel', () => {
    const xhrs = new Set<{ abort: () => void }>()
    const abortCalls: number[] = []

    // Simulate 3 parallel chunk uploads adding their XHRs
    for (let i = 0; i < 3; i++) {
      const xhr = { abort: () => abortCalls.push(i) }
      xhrs.add(xhr)
    }

    expect(xhrs.size).toBe(3)

    // Simulate pause: abort all
    for (const xhr of xhrs) {
      xhr.abort()
    }
    xhrs.clear()

    expect(abortCalls).toEqual([0, 1, 2])
    expect(xhrs.size).toBe(0)
  })

  it('removes XHR on completion', () => {
    const xhrs = new Set<{ abort: () => void }>()
    const xhr1 = { abort: vi.fn() }
    const xhr2 = { abort: vi.fn() }
    const xhr3 = { abort: vi.fn() }

    xhrs.add(xhr1)
    xhrs.add(xhr2)
    xhrs.add(xhr3)

    // xhr2 completes
    xhrs.delete(xhr2)
    expect(xhrs.size).toBe(2)
    expect(xhrs.has(xhr1)).toBe(true)
    expect(xhrs.has(xhr2)).toBe(false)
    expect(xhrs.has(xhr3)).toBe(true)

    // Pause: only 2 XHRs aborted
    for (const xhr of xhrs) {
      xhr.abort()
    }
    expect(xhr1.abort).toHaveBeenCalled()
    expect(xhr2.abort).not.toHaveBeenCalled()
    expect(xhr3.abort).toHaveBeenCalled()
  })
})

describe('Progress tracking logic', () => {
  const UPDATE_INTERVAL = 500

  function simulateProgress(events: { loaded: number; time: number }[]) {
    let lastUpdateTime: number | undefined
    let lastUploadedSize = 0
    let uploadSpeed = 0
    let uploadedSize = 0

    for (const event of events) {
      const currentTime = event.time
      const shouldUpdateSpeed = !!lastUpdateTime && currentTime - lastUpdateTime >= UPDATE_INTERVAL
      const shouldUpdateSize = !lastUpdateTime || shouldUpdateSpeed

      if (shouldUpdateSize) {
        uploadedSize = event.loaded
      }

      if (!lastUpdateTime) {
        lastUpdateTime = currentTime
        lastUploadedSize = event.loaded
        uploadSpeed = 0
        continue
      }

      if (shouldUpdateSpeed) {
        const timeDiffSec = (currentTime - lastUpdateTime) / 1000
        const sizeDiff = event.loaded - lastUploadedSize
        if (sizeDiff > 0 && timeDiffSec > 0) {
          uploadSpeed = Math.round(sizeDiff / timeDiffSec)
        }
        lastUpdateTime = currentTime
        lastUploadedSize = event.loaded
      }
    }

    return { uploadedSize, uploadSpeed }
  }

  it('does not calculate speed on first event', () => {
    const result = simulateProgress([{ loaded: 1000, time: 0 }])
    expect(result.uploadSpeed).toBe(0)
  })

  it('calculates speed after UPDATE_INTERVAL', () => {
    const result = simulateProgress([
      { loaded: 0, time: 1000 },
      { loaded: 500000, time: 1500 }, // 500ms later, 500KB loaded
    ])
    expect(result.uploadSpeed).toBe(1000000) // 1MB/s
  })

  it('ignores events within UPDATE_INTERVAL', () => {
    const result = simulateProgress([
      { loaded: 0, time: 1000 },
      { loaded: 100000, time: 1100 }, // Too soon
      { loaded: 200000, time: 1200 }, // Too soon
    ])
    // Speed should still be 0 since no event was at >= 500ms
    expect(result.uploadSpeed).toBe(0)
    // Size should be 0 (not updated within interval)
    expect(result.uploadedSize).toBe(0)
  })
})
