import { describe, it, expect } from 'vitest'
import { applyScheme, buildUrl } from '@/lib/url'

describe('buildUrl', () => {
  it('omits port 80 for http', () => {
    expect(buildUrl('http', '192.168.1.5', 80)).toBe('http://192.168.1.5')
  })

  it('omits port 80 for ws', () => {
    expect(buildUrl('ws', 'example.com', 80, '/status')).toBe('ws://example.com/status')
  })

  it('omits port 443 for https', () => {
    expect(buildUrl('https', '192.168.1.5', 443, '/fs?id=1')).toBe('https://192.168.1.5/fs?id=1')
  })

  it('omits port 443 for wss', () => {
    expect(buildUrl('wss', 'example.com', 443, '/status')).toBe('wss://example.com/status')
  })

  it('keeps non-default ports', () => {
    expect(buildUrl('https', '192.168.1.5', 8443, '/peer_graphql')).toBe(
      'https://192.168.1.5:8443/peer_graphql'
    )
    expect(buildUrl('http', 'localhost', 8080)).toBe('http://localhost:8080')
  })

  it('keeps default port only for the matching scheme', () => {
    expect(buildUrl('https', '192.168.1.5', 80, '/fs')).toBe('https://192.168.1.5:80/fs')
    expect(buildUrl('http', '192.168.1.5', 443)).toBe('http://192.168.1.5:443')
  })
})

describe('applyScheme', () => {
  it('strips default port from a host-with-port string', () => {
    expect(applyScheme('https', '192.168.1.5:443')).toBe('https://192.168.1.5')
    expect(applyScheme('http', '192.168.1.5:80')).toBe('http://192.168.1.5')
  })

  it('keeps non-default port from a host-with-port string', () => {
    expect(applyScheme('https', '192.168.1.5:8443')).toBe('https://192.168.1.5:8443')
    expect(applyScheme('http', 'localhost:3000')).toBe('http://localhost:3000')
  })

  it('handles hosts without a port', () => {
    expect(applyScheme('https', '192.168.1.5')).toBe('https://192.168.1.5')
    expect(applyScheme('wss', 'example.com')).toBe('wss://example.com')
  })
})
