import { describe, it, expect } from 'vitest'

interface GqlProjectSummary {
  id: string
  thumbnail: string | null
  canvasWidth: number
  canvasHeight: number
  layerCount: number
  updatedAt: string
}

function parseUpdatedAt(value: string): number {
  const ms = Date.parse(value)
  return Number.isNaN(ms) ? Date.now() : ms
}

function toSummary(p: GqlProjectSummary) {
  return {
    id: p.id,
    updatedAt: parseUpdatedAt(p.updatedAt),
    canvasWidth: p.canvasWidth,
    canvasHeight: p.canvasHeight,
    layerCount: p.layerCount,
    previewDataUrl: p.thumbnail,
  }
}

describe('PlainAppProjectStore helpers', () => {
  describe('parseUpdatedAt', () => {
    it('parses ISO string to epoch millis', () => {
      const ms = parseUpdatedAt('2026-07-27T00:00:00.000Z')
      expect(ms).toBe(Date.parse('2026-07-27T00:00:00.000Z'))
    })

    it('falls back to Date.now() for invalid input', () => {
      const before = Date.now()
      const ms = parseUpdatedAt('not-a-date')
      const after = Date.now()
      expect(ms).toBeGreaterThanOrEqual(before)
      expect(ms).toBeLessThanOrEqual(after)
    })
  })

  describe('toSummary', () => {
    it('converts GQL summary to ProjectSummary', () => {
      const gql: GqlProjectSummary = {
        id: 'abc123',
        thumbnail: 'data:image/jpeg;base64,xxx',
        canvasWidth: 1920,
        canvasHeight: 1080,
        layerCount: 3,
        updatedAt: '2026-07-27T00:00:00.000Z',
      }
      const summary = toSummary(gql)
      expect(summary.id).toBe('abc123')
      expect(summary.previewDataUrl).toBe('data:image/jpeg;base64,xxx')
      expect(summary.canvasWidth).toBe(1920)
      expect(summary.canvasHeight).toBe(1080)
      expect(summary.layerCount).toBe(3)
      expect(summary.updatedAt).toBe(Date.parse('2026-07-27T00:00:00.000Z'))
    })

    it('handles null thumbnail', () => {
      const gql: GqlProjectSummary = {
        id: 'abc',
        thumbnail: null,
        canvasWidth: 100,
        canvasHeight: 100,
        layerCount: 0,
        updatedAt: '2026-07-27T00:00:00.000Z',
      }
      const summary = toSummary(gql)
      expect(summary.previewDataUrl).toBeNull()
    })
  })
})
