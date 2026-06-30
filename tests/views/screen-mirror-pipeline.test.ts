import { describe, it, expect, vi } from 'vitest'
import { makePtsClock } from '@/views/screen-mirror/screen-mirror-pipeline'

describe('makePtsClock', () => {
  it('returns 0 on the first call', () => {
    vi.spyOn(performance, 'now').mockReturnValue(1000)
    const clock = makePtsClock()
    expect(clock.next()).toBe(0)
    vi.restoreAllMocks()
  })

  it('returns microseconds since the anchor on subsequent calls', () => {
    let now = 1000
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    const clock = makePtsClock()
    expect(clock.next()).toBe(0)
    now = 1033.5 // 33.5ms later (one 30fps frame interval)
    expect(clock.next()).toBe(33_500)
    now = 1053.5
    expect(clock.next()).toBe(53_500)
    vi.restoreAllMocks()
  })

  it('keeps video and audio on a shared monotonic clock', () => {
    // Simulate interleaved video + audio packets arriving over the same
    // wall-clock window — both streams should report pts that match their
    // arrival time, not jump ahead per stream.
    let now = 5000
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    const video = makePtsClock()
    const audio = makePtsClock()
    expect(video.next()).toBe(0)
    expect(audio.next()).toBe(0)
    now = 5020 // 20ms later — one audio packet at 48kHz/20ms
    expect(audio.next()).toBe(20_000)
    now = 5033 // +13ms — next video frame
    expect(video.next()).toBe(33_000)
    now = 5040
    expect(audio.next()).toBe(40_000)
    expect(video.next()).toBe(40_000)
    vi.restoreAllMocks()
  })

  it('reset() re-anchors the clock so the next call returns 0', () => {
    let now = 1000
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    const clock = makePtsClock()
    expect(clock.next()).toBe(0)
    now = 10_000
    expect(clock.next()).toBe(9_000_000)
    clock.reset()
    expect(clock.next()).toBe(0)
    vi.restoreAllMocks()
  })
})
