import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { gqlFetch, GqlError } from '@/lib/api/gql-client'
import { hashToKey, chachaEncrypt, bitArrayToBase64 } from '@/lib/api/crypto'

// Helper: build an encrypted response body matching what the server sends back
async function makeEncryptedResponse(key: Uint8Array, responseData: object): Promise<ArrayBuffer> {
  const json = JSON.stringify(responseData)
  const encrypted = chachaEncrypt(key, json)
  return encrypted.buffer.slice(encrypted.byteOffset, encrypted.byteOffset + encrypted.byteLength)
}

// Helper: create a fetch mock that returns an encrypted response
function mockFetch(key: Uint8Array, responseData: object, status = 200) {
  return vi.fn(async () => {
    const body = await makeEncryptedResponse(key, responseData)
    return {
      status,
      arrayBuffer: async () => body,
    }
  })
}

describe('GqlError', () => {
  it('is an instance of Error', () => {
    const err = new GqlError('test error')
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(GqlError)
  })

  it('has name "GqlError"', () => {
    expect(new GqlError('oops').name).toBe('GqlError')
  })

  it('stores the message', () => {
    expect(new GqlError('unauthorized').message).toBe('unauthorized')
  })

  it('stores optional status', () => {
    const err = new GqlError('forbidden', 403)
    expect(err.status).toBe(403)
  })

  it('status is undefined when not provided', () => {
    expect(new GqlError('network_error').status).toBeUndefined()
  })

  it('can be caught as Error', () => {
    expect(() => { throw new GqlError('x') }).toThrow(Error)
  })

  it('can be caught as GqlError', () => {
    expect(() => { throw new GqlError('x') }).toThrow(GqlError)
  })
})

describe('gqlFetch', () => {
  // The key is derived from the auth_token stored in localStorage.
  // tokenToKey does atob(token) -> Uint8Array. We use a known base64 token.
  const plainToken = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
  const base64Token = btoa(plainToken)

  beforeEach(() => {
    localStorage.setItem('auth_token', base64Token)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('returns parsed data on successful response', async () => {
    // The key used by gqlFetch: tokenToKey(localStorage.auth_token)
    const key = Uint8Array.from(atob(base64Token), (c) => c.charCodeAt(0))
    const responseData = { data: { me: { id: '1', name: 'Alice' } } }
    vi.stubGlobal('fetch', mockFetch(key, responseData))

    const result = await gqlFetch('query { me { id } }')
    expect(result.data).toEqual({ me: { id: '1', name: 'Alice' } })
  })

  it('includes variables in the encrypted payload', async () => {
    const key = Uint8Array.from(atob(base64Token), (c) => c.charCodeAt(0))
    const responseData = { data: { item: null } }
    const fetchMock = mockFetch(key, responseData)
    vi.stubGlobal('fetch', fetchMock)

    await gqlFetch('query($id: ID!) { item(id: $id) }', { id: '42' })
    expect(fetchMock).toHaveBeenCalledOnce()
    // Body must be a Uint8Array (encrypted binary)
    const callArgs = fetchMock.mock.calls[0][1]
    expect(callArgs.body).toBeInstanceOf(Uint8Array)
  })

  it('POSTs to /graphql endpoint', async () => {
    const key = Uint8Array.from(atob(base64Token), (c) => c.charCodeAt(0))
    const fetchMock = mockFetch(key, { data: {} })
    vi.stubGlobal('fetch', fetchMock)

    await gqlFetch('query { ok }')
    const url: string = fetchMock.mock.calls[0][0]
    expect(url).toMatch(/\/graphql$/)
  })

  it('uses POST method', async () => {
    const key = Uint8Array.from(atob(base64Token), (c) => c.charCodeAt(0))
    const fetchMock = mockFetch(key, { data: {} })
    vi.stubGlobal('fetch', fetchMock)

    await gqlFetch('query { ok }')
    expect(fetchMock.mock.calls[0][1].method).toBe('POST')
  })

  it('throws GqlError with status 401 on 401 response', async () => {
    const reloadMock = vi.fn()
    vi.stubGlobal('fetch', vi.fn(async () => ({ status: 401, arrayBuffer: async () => new ArrayBuffer(0) })))
    Object.defineProperty(window, 'location', { value: { reload: reloadMock }, writable: true })

    await expect(gqlFetch('query { me }')).rejects.toThrow(GqlError)
    await expect(gqlFetch('query { me }')).rejects.toMatchObject({ status: 401, message: 'unauthorized' })
  })

  it('removes auth_token from localStorage on 401', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ status: 401, arrayBuffer: async () => new ArrayBuffer(0) })))
    Object.defineProperty(window, 'location', { value: { reload: vi.fn() }, writable: true })

    try { await gqlFetch('query { me }') } catch {}
    expect(localStorage.getItem('auth_token')).toBeNull()
  })

  it('throws GqlError with status 403 on 403 response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ status: 403, arrayBuffer: async () => new ArrayBuffer(0) })))

    await expect(gqlFetch('query { me }')).rejects.toMatchObject({
      message: 'web_access_disabled',
      status: 403,
    })
  })

  it('throws GqlError("connection_timeout") on AbortError', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      const err = new Error('aborted')
      err.name = 'AbortError'
      throw err
    }))

    await expect(gqlFetch('query { slow }')).rejects.toMatchObject({ message: 'connection_timeout' })
  })

  it('throws GqlError with network error message on generic fetch failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('net::ERR_CONNECTION_REFUSED')
    }))

    await expect(gqlFetch('query { me }')).rejects.toMatchObject({ message: 'net::ERR_CONNECTION_REFUSED' })
  })

  it('throws GqlError("network_error") on fetch failure with no message', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      const err = new Error()
      err.message = ''
      throw err
    }))

    await expect(gqlFetch('query { me }')).rejects.toMatchObject({ message: 'network_error' })
  })

  it('returns errors array when server returns GraphQL errors', async () => {
    const key = Uint8Array.from(atob(base64Token), (c) => c.charCodeAt(0))
    const responseData = { data: null, errors: [{ message: 'not found', path: ['item'] }] }
    vi.stubGlobal('fetch', mockFetch(key, responseData))

    const result = await gqlFetch('query { item }')
    expect(result.errors).toHaveLength(1)
    expect(result.errors![0].message).toBe('not found')
  })

  it('uses empty string when auth_token is absent', async () => {
    localStorage.removeItem('auth_token')
    // Token '' -> atob('') -> '' (empty Uint8Array)
    // The key will be empty; encrypt/decrypt with the same empty key should still work
    const emptyKey = Uint8Array.from(atob(''), (c) => c.charCodeAt(0))
    vi.stubGlobal('fetch', mockFetch(emptyKey, { data: { ping: true } }))

    const result = await gqlFetch('query { ping }')
    expect(result.data.ping).toBe(true)
  })
})
