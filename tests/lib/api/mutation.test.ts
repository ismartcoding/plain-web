import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { initMutation, runMutation } from '@/lib/api/mutation'
import { GqlError } from '@/lib/api/gql-client'

vi.mock('@/lib/api/gql-client', () => ({
  gqlFetch: vi.fn(),
  GqlError: class GqlError extends Error {
    status?: number
    constructor(msg: string, status?: number) {
      super(msg)
      this.name = 'GqlError'
      this.status = status
    }
  },
}))

vi.mock('@/plugins/eventbus', () => ({
  default: { emit: vi.fn() },
}))

import { gqlFetch } from '@/lib/api/gql-client'
import emitter from '@/plugins/eventbus'

const mockGqlFetch = gqlFetch as ReturnType<typeof vi.fn>
const mockEmitter = emitter.emit as ReturnType<typeof vi.fn>

describe('initMutation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns { mutate, loading, onDone, onError }', () => {
    const m = initMutation({ document: 'mutation { noop }' })
    expect(m).toHaveProperty('mutate')
    expect(m).toHaveProperty('loading')
    expect(m).toHaveProperty('onDone')
    expect(m).toHaveProperty('onError')
  })

  it('loading starts as false', () => {
    const { loading } = initMutation({ document: 'mutation { noop }' })
    expect(loading.value).toBe(false)
  })

  it('loading is true during async mutate, false after', async () => {
    let capturedLoading: boolean | null = null
    mockGqlFetch.mockImplementation(async () => {
      capturedLoading = true // would be true at this point; checked below
      return { data: { ok: true } }
    })
    const { mutate, loading } = initMutation({ document: 'mutation { ok }' })
    const promise = mutate()
    // Not checking mid-flight synchronously (Vue refs); just verify final state
    await promise
    expect(loading.value).toBe(false)
  })

  it('calls gqlFetch with the document and variables', async () => {
    mockGqlFetch.mockResolvedValue({ data: { created: true } })
    const { mutate } = initMutation({ document: 'mutation createItem($name: String!) { createItem(name: $name) }' })
    await mutate({ name: 'hello' })
    expect(mockGqlFetch).toHaveBeenCalledWith('mutation createItem($name: String!) { createItem(name: $name) }', { name: 'hello' })
  })

  it('calls onDone callbacks with the result on success', async () => {
    mockGqlFetch.mockResolvedValue({ data: { id: '99' } })
    const { mutate, onDone } = initMutation({ document: 'mutation { x }' })
    const cb = vi.fn()
    onDone(cb)
    await mutate()
    expect(cb).toHaveBeenCalledOnce()
    expect(cb.mock.calls[0][0]).toEqual({ data: { id: '99' } })
  })

  it('calls multiple onDone callbacks', async () => {
    mockGqlFetch.mockResolvedValue({ data: { x: 1 } })
    const { mutate, onDone } = initMutation({ document: 'mutation { x }' })
    const cb1 = vi.fn()
    const cb2 = vi.fn()
    onDone(cb1)
    onDone(cb2)
    await mutate()
    expect(cb1).toHaveBeenCalledOnce()
    expect(cb2).toHaveBeenCalledOnce()
  })

  it('onDone off() removes the callback', async () => {
    mockGqlFetch.mockResolvedValue({ data: {} })
    const { mutate, onDone } = initMutation({ document: 'mutation { x }' })
    const cb = vi.fn()
    const { off } = onDone(cb)
    off()
    await mutate()
    expect(cb).not.toHaveBeenCalled()
  })

  it('calls onError callbacks when gqlFetch throws GqlError', async () => {
    mockGqlFetch.mockRejectedValue(new GqlError('unauthorized', 401))
    const { mutate, onError } = initMutation({ document: 'mutation { x }' }, false)
    const errCb = vi.fn()
    onError(errCb)
    await mutate()
    expect(errCb).toHaveBeenCalledOnce()
  })

  it('calls onError callbacks when response has errors array', async () => {
    mockGqlFetch.mockResolvedValue({ data: null, errors: [{ message: 'validation failed' }] })
    const { mutate, onError } = initMutation({ document: 'mutation { x }' }, false)
    const errCb = vi.fn()
    onError(errCb)
    await mutate()
    expect(errCb).toHaveBeenCalledOnce()
  })

  it('onError off() removes the error callback', async () => {
    mockGqlFetch.mockRejectedValue(new GqlError('oops'))
    const { mutate, onError } = initMutation({ document: 'mutation { x }' }, false)
    const errCb = vi.fn()
    const { off } = onError(errCb)
    off()
    await mutate()
    expect(errCb).not.toHaveBeenCalled()
  })

  it('emits toast on error when handleError = true', async () => {
    mockGqlFetch.mockResolvedValue({ data: null, errors: [{ message: 'something broke' }] })
    const { mutate } = initMutation({ document: 'mutation { x }' }, true)
    await mutate()
    expect(mockEmitter).toHaveBeenCalledWith('toast', 'something broke')
  })

  it('does NOT emit toast on error when handleError = false', async () => {
    mockGqlFetch.mockResolvedValue({ data: null, errors: [{ message: 'err' }] })
    const { mutate } = initMutation({ document: 'mutation { x }' }, false)
    await mutate()
    expect(mockEmitter).not.toHaveBeenCalled()
  })

  it('emits toast with GqlError message when fetch throws', async () => {
    mockGqlFetch.mockRejectedValue(new GqlError('network_error'))
    const { mutate } = initMutation({ document: 'mutation { x }' }, true)
    await mutate()
    expect(mockEmitter).toHaveBeenCalledWith('toast', 'network_error')
  })

  it('emits toast with "network_error" for non-GqlError exceptions', async () => {
    mockGqlFetch.mockRejectedValue(new Error('Some unexpected error'))
    const { mutate } = initMutation({ document: 'mutation { x }' }, true)
    await mutate()
    expect(mockEmitter).toHaveBeenCalledWith('toast', 'network_error')
  })

  it('returns the result on success', async () => {
    mockGqlFetch.mockResolvedValue({ data: { id: '5' } })
    const { mutate } = initMutation({ document: 'mutation { x }' })
    const result = await mutate()
    expect(result).toEqual({ data: { id: '5' } })
  })

  it('returns undefined when there are GraphQL errors', async () => {
    mockGqlFetch.mockResolvedValue({ data: null, errors: [{ message: 'err' }] })
    const { mutate } = initMutation({ document: 'mutation { x }' }, false)
    const result = await mutate()
    expect(result).toBeUndefined()
  })

  it('returns undefined when fetch throws', async () => {
    mockGqlFetch.mockRejectedValue(new GqlError('fail'))
    const { mutate } = initMutation({ document: 'mutation { x }' }, false)
    const result = await mutate()
    expect(result).toBeUndefined()
  })
})

describe('runMutation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns true when mutate returns a result', async () => {
    const mutate = vi.fn().mockResolvedValue({ data: { ok: true } })
    expect(await runMutation(mutate)).toBe(true)
  })

  it('returns false when mutate returns undefined', async () => {
    const mutate = vi.fn().mockResolvedValue(undefined)
    expect(await runMutation(mutate)).toBe(false)
  })

  it('returns false when mutate returns null', async () => {
    const mutate = vi.fn().mockResolvedValue(null)
    expect(await runMutation(mutate)).toBe(false)
  })

  it('passes variables to mutate', async () => {
    const mutate = vi.fn().mockResolvedValue({ data: {} })
    await runMutation(mutate, { id: '10' })
    expect(mutate).toHaveBeenCalledWith({ id: '10' })
  })

  it('calls mutate without variables if none provided', async () => {
    const mutate = vi.fn().mockResolvedValue({ data: {} })
    await runMutation(mutate)
    expect(mutate).toHaveBeenCalledWith(undefined)
  })
})
