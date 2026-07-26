import { describe, it, expect } from 'vitest'
import * as Y from 'yjs'

describe('Yjs sync protocol helpers', () => {
  it('encodeStateVector produces non-empty bytes', () => {
    const doc = new Y.Doc()
    doc.getMap('test').set('a', 1)
    const sv = Y.encodeStateVector(doc)
    expect(sv.length).toBeGreaterThan(0)
  })

  it('encodeStateAsUpdate with state vector produces diff', () => {
    const doc1 = new Y.Doc()
    doc1.getMap('test').set('a', 1)
    doc1.getMap('test').set('b', 2)

    const doc2 = new Y.Doc()
    doc2.getMap('test').set('a', 1)

    const sv2 = Y.encodeStateVector(doc2)
    const diff = Y.encodeStateAsUpdate(doc1, sv2)
    expect(diff.length).toBeGreaterThan(0)

    Y.applyUpdate(doc2, diff, 'remote')
    expect(doc2.getMap('test').get('b')).toBe(2)
  })

  it('applyUpdate with remote origin applies changes', () => {
    const doc1 = new Y.Doc()
    const doc2 = new Y.Doc()

    doc1.getArray('list').push(['item1'])
    const update = Y.encodeStateAsUpdate(doc1)
    Y.applyUpdate(doc2, update, 'remote')

    expect(doc2.getArray('list').length).toBe(1)
    expect(doc2.getArray('list').get(0)).toBe('item1')
  })

  it('empty state vector produces full state', () => {
    const doc = new Y.Doc()
    doc.getMap('test').set('a', 1)
    const emptySv = Y.encodeStateVector(new Y.Doc())
    const fullUpdate = Y.encodeStateAsUpdate(doc, emptySv)
    expect(fullUpdate.length).toBeGreaterThan(0)

    const doc2 = new Y.Doc()
    Y.applyUpdate(doc2, fullUpdate, 'remote')
    expect(doc2.getMap('test').get('a')).toBe(1)
  })
})

describe('WebSocket sync message framing', () => {
  const MSG_SYNC_STEP1 = 0
  const MSG_SYNC_STEP2 = 1

  function encodeMessage(type: number, payload: Uint8Array): Uint8Array {
    const out = new Uint8Array(1 + payload.length)
    out[0] = type
    out.set(payload, 1)
    return out
  }

  function decodeMessage(data: Uint8Array): { type: number; payload: Uint8Array } | null {
    if (data.length < 1) return null
    return { type: data[0]!, payload: data.subarray(1) }
  }

  it('encodes and decodes SYNC_STEP1', () => {
    const sv = new Uint8Array([1, 2, 3, 4])
    const msg = encodeMessage(MSG_SYNC_STEP1, sv)
    expect(msg[0]).toBe(MSG_SYNC_STEP1)
    const decoded = decodeMessage(msg)
    expect(decoded?.type).toBe(MSG_SYNC_STEP1)
    expect(Array.from(decoded!.payload)).toEqual([1, 2, 3, 4])
  })

  it('encodes and decodes SYNC_STEP2', () => {
    const update = new Uint8Array([0, 1, 2, 3, 4, 5])
    const msg = encodeMessage(MSG_SYNC_STEP2, update)
    const decoded = decodeMessage(msg)
    expect(decoded?.type).toBe(MSG_SYNC_STEP2)
    expect(Array.from(decoded!.payload)).toEqual([0, 1, 2, 3, 4, 5])
  })

  it('returns null for empty message', () => {
    expect(decodeMessage(new Uint8Array())).toBeNull()
  })
})
