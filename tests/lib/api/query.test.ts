import { describe, it, expect, vi, beforeEach } from 'vitest'
import { initQuery, initLazyQuery } from '@/lib/api/query'
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

// Use the real fragment strings so GQL template literals don't throw
vi.mock('@/lib/api/fragments', async (importOriginal) => {
  return await importOriginal()
})

import { gqlFetch } from '@/lib/api/gql-client'
const mockGqlFetch = gqlFetch as ReturnType<typeof vi.fn>

describe('initQuery', () => {
  beforeEach(() => vi.clearAllMocks())

  it('executes immediately on setup', async () => {
    mockGqlFetch.mockResolvedValue({ data: { items: [] } })
    const handle = vi.fn()
    initQuery({ document: 'query { items }', handle })
    // flush microtasks
    await new Promise((r) => setTimeout(r, 0))
    expect(mockGqlFetch).toHaveBeenCalledOnce()
  })

  it('calls handle(data, "") on success', async () => {
    mockGqlFetch.mockResolvedValue({ data: { items: [1, 2] } })
    const handle = vi.fn()
    initQuery({ document: 'query { items }', handle })
    await new Promise((r) => setTimeout(r, 0))
    expect(handle).toHaveBeenCalledWith({ items: [1, 2] }, '')
  })

  it('calls handle(data, errorMessage) when server returns errors', async () => {
    mockGqlFetch.mockResolvedValue({ data: null, errors: [{ message: 'not authorized' }] })
    const handle = vi.fn()
    initQuery({ document: 'query { items }', handle })
    await new Promise((r) => setTimeout(r, 0))
    expect(handle).toHaveBeenCalledWith(null, 'not authorized')
  })

  it('calls handle(undefined, "desktop_access_disabled") on 403 GqlError', async () => {
    const err = new GqlError('desktop_access_disabled', 403)
    mockGqlFetch.mockRejectedValue(err)
    const handle = vi.fn()
    initQuery({ document: 'query { items }', handle })
    await new Promise((r) => setTimeout(r, 0))
    expect(handle).toHaveBeenCalledWith(undefined, 'desktop_access_disabled')
  })

  it('calls handle(undefined, message) on other GqlError', async () => {
    const err = new GqlError('connection_timeout')
    mockGqlFetch.mockRejectedValue(err)
    const handle = vi.fn()
    initQuery({ document: 'query { items }', handle })
    await new Promise((r) => setTimeout(r, 0))
    expect(handle).toHaveBeenCalledWith(undefined, 'connection_timeout')
  })

  it('calls handle(undefined, "network_error") on non-GqlError exception', async () => {
    mockGqlFetch.mockRejectedValue(new Error('fetch failed'))
    const handle = vi.fn()
    initQuery({ document: 'query { items }', handle })
    await new Promise((r) => setTimeout(r, 0))
    expect(handle).toHaveBeenCalledWith(undefined, 'network_error')
  })

  it('returns { loading, result, refetch }', () => {
    mockGqlFetch.mockResolvedValue({ data: {} })
    const q = initQuery({ document: 'query { x }', handle: vi.fn() })
    expect(q).toHaveProperty('loading')
    expect(q).toHaveProperty('result')
    expect(q).toHaveProperty('refetch')
  })

  it('result.value is set after successful query', async () => {
    mockGqlFetch.mockResolvedValue({ data: { count: 42 } })
    const handle = vi.fn()
    const { result } = initQuery({ document: 'query { count }', handle })
    await new Promise((r) => setTimeout(r, 0))
    expect(result.value).toEqual({ count: 42 })
  })

  it('refetch re-executes the query', async () => {
    mockGqlFetch.mockResolvedValue({ data: {} })
    const { refetch } = initQuery({ document: 'query { x }', handle: vi.fn() })
    await new Promise((r) => setTimeout(r, 0))
    await refetch()
    expect(mockGqlFetch).toHaveBeenCalledTimes(2)
  })

  it('passes static variables to gqlFetch', async () => {
    mockGqlFetch.mockResolvedValue({ data: {} })
    initQuery({ document: 'query($id: ID!){ x(id: $id) }', variables: { id: '7' }, handle: vi.fn() })
    await new Promise((r) => setTimeout(r, 0))
    expect(mockGqlFetch).toHaveBeenCalledWith('query($id: ID!){ x(id: $id) }', { id: '7' })
  })

  it('loading is false after fetch completes', async () => {
    mockGqlFetch.mockResolvedValue({ data: {} })
    const { loading } = initQuery({ document: 'query { x }', handle: vi.fn() })
    await new Promise((r) => setTimeout(r, 0))
    expect(loading.value).toBe(false)
  })
})

describe('initLazyQuery', () => {
  beforeEach(() => vi.clearAllMocks())

  it('does NOT call gqlFetch immediately', async () => {
    mockGqlFetch.mockResolvedValue({ data: {} })
    initLazyQuery({ document: 'query { x }', handle: vi.fn() })
    await new Promise((r) => setTimeout(r, 0))
    expect(mockGqlFetch).not.toHaveBeenCalled()
  })

  it('returns { loading, result, fetch }', () => {
    const q = initLazyQuery({ document: 'query { x }', handle: vi.fn() })
    expect(q).toHaveProperty('loading')
    expect(q).toHaveProperty('result')
    expect(q).toHaveProperty('fetch')
  })

  it('executes query when fetch() is called', async () => {
    mockGqlFetch.mockResolvedValue({ data: { x: 1 } })
    const handle = vi.fn()
    const { fetch } = initLazyQuery({ document: 'query { x }', handle })
    await fetch()
    expect(mockGqlFetch).toHaveBeenCalledOnce()
    expect(handle).toHaveBeenCalledWith({ x: 1 }, '', expect.any(Object))
  })

  it('passes variables provided to fetch()', async () => {
    mockGqlFetch.mockResolvedValue({ data: {} })
    const { fetch } = initLazyQuery({ document: 'query($q: String!){ search(q: $q) }', handle: vi.fn() })
    await fetch({ q: 'test' })
    expect(mockGqlFetch).toHaveBeenCalledWith('query($q: String!){ search(q: $q) }', { q: 'test' })
  })

  it('result.value is set on success', async () => {
    mockGqlFetch.mockResolvedValue({ data: { items: ['a', 'b'] } })
    const { fetch, result } = initLazyQuery({ document: 'query { items }', handle: vi.fn() })
    await fetch()
    expect(result.value).toEqual({ items: ['a', 'b'] })
  })

  it('calls handle(data, error) when server returns errors', async () => {
    mockGqlFetch.mockResolvedValue({ data: null, errors: [{ message: 'bad input' }] })
    const handle = vi.fn()
    const { fetch } = initLazyQuery({ document: 'query { items }', handle })
    await fetch()
    expect(handle).toHaveBeenCalledWith(null, 'bad input', expect.any(Object))
  })

  it('calls handle(undefined, "network_error") on non-GqlError exception', async () => {
    mockGqlFetch.mockRejectedValue(new TypeError('timeout'))
    const handle = vi.fn()
    const { fetch } = initLazyQuery({ document: 'query { items }', handle })
    await fetch()
    expect(handle).toHaveBeenCalledWith(undefined, 'network_error', expect.any(Object))
  })

  it('loading is false after fetch completes', async () => {
    mockGqlFetch.mockResolvedValue({ data: {} })
    const { fetch, loading } = initLazyQuery({ document: 'query { x }', handle: vi.fn() })
    await fetch()
    expect(loading.value).toBe(false)
  })

  it('can be called multiple times', async () => {
    mockGqlFetch.mockResolvedValue({ data: {} })
    const { fetch } = initLazyQuery({ document: 'query { x }', handle: vi.fn() })
    await fetch()
    await fetch()
    expect(mockGqlFetch).toHaveBeenCalledTimes(2)
  })

  it('forces an invalidation request to bypass transport deduplication', async () => {
    mockGqlFetch.mockResolvedValue({ data: { x: 1 } })
    const { fetch } = initLazyQuery({ document: 'query { x }', handle: vi.fn() })

    await fetch(undefined, { force: true })

    expect(mockGqlFetch).toHaveBeenCalledWith('query { x }', undefined, { fresh: true })
  })

  it('ignores an older response when latest-only requests finish out of order', async () => {
    let resolveOld!: (value: any) => void
    let resolveNew!: (value: any) => void
    mockGqlFetch
      .mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveNew = resolve }))
    const handle = vi.fn()
    const { fetch, result, loading } = initLazyQuery({ document: 'query { x }', handle })

    const oldRequest = fetch({ version: 1 }, { latest: true })
    const newRequest = fetch({ version: 2 }, { latest: true })
    resolveNew({ data: { x: 'new' } })
    await newRequest
    expect(loading.value).toBe(false)
    resolveOld({ data: { x: 'old' } })
    await oldRequest

    expect(handle).toHaveBeenCalledOnce()
    expect(handle).toHaveBeenCalledWith({ x: 'new' }, '', expect.objectContaining({ variables: { version: 2 } }))
    expect(result.value).toEqual({ x: 'new' })
  })

  it('does not let a regular request invalidate the latest-only generation', async () => {
    let resolveLatest!: (value: any) => void
    mockGqlFetch
      .mockImplementationOnce(() => new Promise((resolve) => { resolveLatest = resolve }))
      .mockResolvedValueOnce({ data: { x: 'regular' } })
    const handle = vi.fn()
    const { fetch } = initLazyQuery({ document: 'query { x }', handle })

    const latest = fetch({ version: 1 }, { latest: true })
    await fetch({ version: 2 })
    resolveLatest({ data: { x: 'latest' } })
    await latest

    expect(handle).toHaveBeenLastCalledWith(
      { x: 'latest' }, '', expect.objectContaining({ variables: { version: 1 } }),
    )
  })
})
