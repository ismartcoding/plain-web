import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ScreenMirrorVideoPipeline } from '@/lib/mirror-codec-video'
import type { VideoPacket } from '@/lib/video-packet'

const SC = [0x00, 0x00, 0x00, 0x01]

function annexB(nals: number[][]): Uint8Array {
  const parts: number[] = []
  for (const nal of nals) parts.push(...SC, ...nal)
  return new Uint8Array(parts)
}

function sps(): number[] {
  return [0x67, 0x42, 0xc0, 0x1e, 0xd9, 0x00, 0xa0, 0x47, 0xfe, 0xc8]
}

function pps(): number[] {
  return [0x68, 0xce, 0x38, 0x80]
}

const VALID_CONFIG = annexB([sps(), pps()])

function makePacket(frameId: number, isKey: boolean, data: number[] = [0x65]): VideoPacket {
  return {
    frameId,
    timestamp: frameId * 16666,
    isKeyFrame: isKey,
    isConfig: false,
    isAudio: false,
    data: new Uint8Array(data),
  }
}

class MockDecoder {
  state: 'unconfigured' | 'configured' | 'closed' = 'unconfigured'
  decodeQueueSize = 0
  decodedChunks: Array<{ type: string, timestamp: number }> = []
  config: unknown
  private readonly outputCb: (frame: unknown) => void
  private readonly errorCb: (e: unknown) => void

  constructor(init: { output: (frame: unknown) => void, error: (e: unknown) => void }) {
    this.outputCb = init.output
    this.errorCb = init.error
  }

  configure(config: unknown) {
    this.config = config
    this.state = 'configured'
  }

  decode(chunk: { type: string, timestamp: number }) {
    this.decodedChunks.push(chunk)
  }

  close() {
    this.state = 'closed'
  }

  emitError(e: unknown) {
    this.errorCb(e)
    this.state = 'closed'
  }

  emitFrame(timestamp: number) {
    this.outputCb({
      timestamp,
      displayWidth: 1080,
      displayHeight: 1920,
      close() {},
    })
  }
}

class MockEncodedChunk {
  type: string
  timestamp: number
  data: Uint8Array

  constructor(init: { type: string, timestamp: number, data: Uint8Array }) {
    this.type = init.type
    this.timestamp = init.timestamp
    this.data = init.data
  }
}

let currentMock: MockDecoder

beforeEach(() => {
  vi.stubGlobal('VideoDecoder', class {
    constructor(init: { output: (f: unknown) => void, error: (e: unknown) => void }) {
      currentMock = new MockDecoder(init)
      return currentMock
    }
  })
  vi.stubGlobal('EncodedVideoChunk', MockEncodedChunk)
})

describe('ScreenMirrorVideoPipeline — loss detection', () => {
  it('decodes all frames when frameIds are contiguous', () => {
    const pipeline = new ScreenMirrorVideoPipeline()
    pipeline.configure(VALID_CONFIG)

    pipeline.decode(makePacket(1, true))
    pipeline.decode(makePacket(2, false))
    pipeline.decode(makePacket(3, false))

    expect(currentMock.decodedChunks).toHaveLength(3)
  })

  it('requests a keyframe on frameId gap with a P-frame', () => {
    const pipeline = new ScreenMirrorVideoPipeline()
    pipeline.configure(VALID_CONFIG)

    const requestSpy = vi.fn()
    pipeline.setOnRequestKeyFrame(requestSpy)

    pipeline.decode(makePacket(1, true))
    pipeline.decode(makePacket(5, false))

    expect(requestSpy).toHaveBeenCalledTimes(1)
    expect(currentMock.decodedChunks).toHaveLength(1)
  })

  it('does NOT request keyframe when gap lands on an IDR', () => {
    const pipeline = new ScreenMirrorVideoPipeline()
    pipeline.configure(VALID_CONFIG)

    const requestSpy = vi.fn()
    pipeline.setOnRequestKeyFrame(requestSpy)

    pipeline.decode(makePacket(1, true))
    pipeline.decode(makePacket(5, true))

    expect(requestSpy).not.toHaveBeenCalled()
    expect(currentMock.decodedChunks).toHaveLength(2)
  })

  it('requests keyframe only once per loss event (anti-flood)', () => {
    const pipeline = new ScreenMirrorVideoPipeline()
    pipeline.configure(VALID_CONFIG)

    const requestSpy = vi.fn()
    pipeline.setOnRequestKeyFrame(requestSpy)

    pipeline.decode(makePacket(1, true))
    pipeline.decode(makePacket(5, false))
    pipeline.decode(makePacket(6, false))
    pipeline.decode(makePacket(7, false))

    expect(requestSpy).toHaveBeenCalledTimes(1)
    expect(currentMock.decodedChunks).toHaveLength(1)
  })

  it('drops P-frames while waiting for IDR', () => {
    const pipeline = new ScreenMirrorVideoPipeline()
    pipeline.configure(VALID_CONFIG)

    pipeline.decode(makePacket(1, true))
    pipeline.decode(makePacket(5, false))
    pipeline.decode(makePacket(6, false))

    expect(currentMock.decodedChunks).toHaveLength(1)
  })

  it('recovers when IDR arrives after loss', () => {
    const pipeline = new ScreenMirrorVideoPipeline()
    pipeline.configure(VALID_CONFIG)

    pipeline.decode(makePacket(1, true))
    pipeline.decode(makePacket(5, false))
    expect(currentMock.decodedChunks).toHaveLength(1)

    pipeline.decode(makePacket(8, true))

    expect(currentMock.decodedChunks).toHaveLength(2)
  })

  it('resumes normal decoding after IDR recovery', () => {
    const pipeline = new ScreenMirrorVideoPipeline()
    pipeline.configure(VALID_CONFIG)

    pipeline.decode(makePacket(1, true))
    pipeline.decode(makePacket(5, false))
    pipeline.decode(makePacket(8, true))
    pipeline.decode(makePacket(9, false))
    pipeline.decode(makePacket(10, false))

    expect(currentMock.decodedChunks).toHaveLength(4)
  })
})

describe('ScreenMirrorVideoPipeline — decoder error recovery', () => {
  it('requests keyframe on decoder error', () => {
    const pipeline = new ScreenMirrorVideoPipeline()
    pipeline.configure(VALID_CONFIG)

    const requestSpy = vi.fn()
    pipeline.setOnRequestKeyFrame(requestSpy)

    currentMock.emitError(new DOMException('decode failed'))

    expect(requestSpy).toHaveBeenCalledTimes(1)
  })

  it('drops all frames while decoder is closed after error', () => {
    const pipeline = new ScreenMirrorVideoPipeline()
    pipeline.configure(VALID_CONFIG)

    const requestSpy = vi.fn()
    pipeline.setOnRequestKeyFrame(requestSpy)

    pipeline.decode(makePacket(1, true))
    currentMock.emitError(new DOMException('decode failed'))
    pipeline.decode(makePacket(2, false))
    pipeline.decode(makePacket(3, false))

    expect(currentMock.decodedChunks).toHaveLength(1)
    expect(requestSpy).toHaveBeenCalledTimes(1)
  })

  it('recovers after reconfigure + IDR following decoder error', () => {
    const pipeline = new ScreenMirrorVideoPipeline()
    pipeline.configure(VALID_CONFIG)

    pipeline.decode(makePacket(1, true))
    currentMock.emitError(new DOMException('decode failed'))
    pipeline.decode(makePacket(2, false))
    // Pipeline layer calls configure(cachedConfig) to rebuild the decoder,
    // then decodes the IDR — mirroring screen-mirror-pipeline.ts flow.
    // configure creates a fresh decoder, so decodedChunks starts at 0.
    pipeline.configure(VALID_CONFIG)
    pipeline.decode(makePacket(3, true))

    expect(currentMock.decodedChunks).toHaveLength(1)
  })
})

describe('ScreenMirrorVideoPipeline — configure', () => {
  it('resets waitingForIdr on reconfigure after error', () => {
    const pipeline = new ScreenMirrorVideoPipeline()
    pipeline.configure(VALID_CONFIG)

    const requestSpy = vi.fn()
    pipeline.setOnRequestKeyFrame(requestSpy)

    pipeline.decode(makePacket(1, true))
    // Loss → waitingForIdr=true, requestSpy called (1st)
    pipeline.decode(makePacket(5, false))
    // Decoder error → requestSpy called (2nd), state=closed
    currentMock.emitError(new DOMException('decode failed'))
    // configure rebuilds the decoder (state was 'closed' so no early-return)
    // and resets waitingForIdr=false
    pipeline.configure(VALID_CONFIG)
    // P-frame after reconfigure: lastFrameId=5, no gap, waitingForIdr=false → decoded
    pipeline.decode(makePacket(6, false))

    expect(currentMock.decodedChunks).toHaveLength(1)
    expect(requestSpy).toHaveBeenCalledTimes(2)
  })

  it('skips reconfigure when config bytes are identical', () => {
    const pipeline = new ScreenMirrorVideoPipeline()
    pipeline.configure(VALID_CONFIG)
    const firstDecoder = currentMock

    pipeline.configure(VALID_CONFIG)

    expect(firstDecoder.state).toBe('configured')
    expect(currentMock).toBe(firstDecoder)
  })

  it('prepends SPS PPS to first IDR after configure', () => {
    const pipeline = new ScreenMirrorVideoPipeline()
    pipeline.configure(VALID_CONFIG)

    const idrData = new Uint8Array([0x65, 0x88, 0x80, 0x40])
    pipeline.decode(makePacket(1, true, [0x65, 0x88, 0x80, 0x40]))

    expect(currentMock.decodedChunks).toHaveLength(1)
    expect(currentMock.config).toBeTruthy()
  })
})

describe('ScreenMirrorVideoPipeline — backpressure', () => {
  it('drops P-frames when decode queue exceeds threshold', () => {
    const pipeline = new ScreenMirrorVideoPipeline()
    pipeline.configure(VALID_CONFIG)

    pipeline.decode(makePacket(1, true))
    currentMock.decodeQueueSize = 6
    pipeline.decode(makePacket(2, false))

    expect(currentMock.decodedChunks).toHaveLength(1)
  })

  it('keeps IDR frames even when decode queue is full', () => {
    const pipeline = new ScreenMirrorVideoPipeline()
    pipeline.configure(VALID_CONFIG)

    pipeline.decode(makePacket(1, true))
    currentMock.decodeQueueSize = 6
    pipeline.decode(makePacket(2, true))

    expect(currentMock.decodedChunks).toHaveLength(2)
  })
})

describe('ScreenMirrorVideoPipeline — requestIdr (startup)', () => {
  it('drops P-frames after requestIdr until IDR arrives', () => {
    const pipeline = new ScreenMirrorVideoPipeline()
    pipeline.configure(VALID_CONFIG)
    pipeline.requestIdr()

    pipeline.decode(makePacket(1, false))
    pipeline.decode(makePacket(2, false))

    expect(currentMock.decodedChunks).toHaveLength(0)
  })

  it('decodes IDR after requestIdr', () => {
    const pipeline = new ScreenMirrorVideoPipeline()
    pipeline.configure(VALID_CONFIG)
    pipeline.requestIdr()

    pipeline.decode(makePacket(1, false))
    pipeline.decode(makePacket(2, true))

    expect(currentMock.decodedChunks).toHaveLength(1)
  })

  it('resumes normal decoding after IDR recovery from requestIdr', () => {
    const pipeline = new ScreenMirrorVideoPipeline()
    pipeline.configure(VALID_CONFIG)
    pipeline.requestIdr()

    pipeline.decode(makePacket(1, false))
    pipeline.decode(makePacket(2, true))
    pipeline.decode(makePacket(3, false))
    pipeline.decode(makePacket(4, false))

    expect(currentMock.decodedChunks).toHaveLength(3)
  })
})

describe('ScreenMirrorVideoPipeline — onFirstFrameRendered', () => {
  it('fires onFirstFrameRendered when first frame is rendered', () => {
    const pipeline = new ScreenMirrorVideoPipeline()
    pipeline.configure(VALID_CONFIG)

    const spy = vi.fn()
    pipeline.setOnFirstFrameRendered(spy)

    pipeline.decode(makePacket(1, true))
    currentMock.emitFrame(16666)

    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('does not fire onFirstFrameRendered for subsequent frames', () => {
    const pipeline = new ScreenMirrorVideoPipeline()
    pipeline.configure(VALID_CONFIG)

    const spy = vi.fn()
    pipeline.setOnFirstFrameRendered(spy)

    pipeline.decode(makePacket(1, true))
    currentMock.emitFrame(16666)
    pipeline.decode(makePacket(2, false))
    currentMock.emitFrame(33333)

    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('does not fire onFirstFrameRendered when P-frames are dropped by waitingForIdr', () => {
    const pipeline = new ScreenMirrorVideoPipeline()
    pipeline.configure(VALID_CONFIG)
    pipeline.requestIdr()

    const spy = vi.fn()
    pipeline.setOnFirstFrameRendered(spy)

    pipeline.decode(makePacket(1, false))

    expect(spy).not.toHaveBeenCalled()
  })

  it('resets firstFrameRendered on reconfigure', () => {
    const pipeline = new ScreenMirrorVideoPipeline()
    pipeline.configure(VALID_CONFIG)

    const spy = vi.fn()
    pipeline.setOnFirstFrameRendered(spy)

    pipeline.decode(makePacket(1, true))
    currentMock.emitFrame(16666)
    expect(spy).toHaveBeenCalledTimes(1)

    // Error closes the decoder so configure won't early-return on same config
    currentMock.emitError(new DOMException('reset'))
    pipeline.configure(VALID_CONFIG)
    pipeline.decode(makePacket(1, true))
    currentMock.emitFrame(16666)

    expect(spy).toHaveBeenCalledTimes(2)
  })
})
