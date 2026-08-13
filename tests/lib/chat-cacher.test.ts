import { describe, it, expect, vi } from 'vitest'
import { normalizeChatItem, mapChatId } from '@/lib/chat/chat-cacher'
import { getChatPreview } from '@/lib/chat/chat-preview'

vi.mock('@/lib/prefs', () => ({
  get: () => '',
  set: () => {},
}))

// Real data observed in the local_chat.db
const channelItem = {
  id: 'cc40854d210a8aa6',
  fromId: 'me',
  toId: '',
  channelId: 'trwfdyxzf0hh',
  content: '{"type":"IMAGES","value":{"items":[{"uri":"fid:0864fe455edafd5ff3ed0b5ee9bf1bc99","fileName":"a.jpg","size":1234}]}}',
  createdAt: '2026-08-13T14:17:59Z',
}

const localItem = {
  id: 'b2a24c0194b7ea1c',
  fromId: 'me',
  toId: 'local',
  channelId: '',
  content: '{"type":"IMAGES","value":{"items":[{"uri":"fid:0864fe455edafd5ff3ed0b5ee9bf1bc99","fileName":"a.jpg","size":1234}]}}',
  createdAt: '2026-08-13T14:17:52Z',
}

const peerItem = {
  id: '9a2c713111299e8a',
  fromId: 'me',
  toId: '1j04cvgdd2pk1',
  channelId: '',
  content: '{"type":"TEXT","value":{"text":"hi"}}',
  createdAt: '2026-08-13T13:51:19Z',
}

describe('mapChatId with real db data', () => {
  const peerIds = new Set(['1xvuvk3ujzxyn', '1j04cvgdd2pk1'])
  const channelIds = new Set(['trwfdyxzf0hh'])

  it('maps channel item to channel:<id>', () => {
    expect(mapChatId(channelItem as any, peerIds, channelIds)).toBe('channel:trwfdyxzf0hh')
  })

  it('maps local item to peer:local', () => {
    expect(mapChatId(localItem as any, peerIds, channelIds)).toBe('peer:local')
  })

  it('maps peer item to peer:<id>', () => {
    expect(mapChatId(peerItem as any, peerIds, channelIds)).toBe('peer:1j04cvgdd2pk1')
  })

  it('normalizes content into _content', () => {
    const normalized = normalizeChatItem(peerItem as any)
    expect(normalized._content).toEqual({ type: 'TEXT', value: { text: 'hi' } })
  })

  it('produces the correct sidebar preview for real data', () => {
    expect(getChatPreview(normalizeChatItem(peerItem as any)._content)).toBe('hi')
    expect(getChatPreview(normalizeChatItem(localItem as any)._content)).toBe('[Image]')
    expect(getChatPreview(normalizeChatItem(channelItem as any)._content)).toBe('[Image]')
  })

  it('falls back to peer:toId even when peerIds is empty (stale race)', () => {
    expect(mapChatId(peerItem as any, new Set(), channelIds)).toBe('peer:1j04cvgdd2pk1')
    expect(mapChatId(localItem as any, new Set(), channelIds)).toBe('peer:local')
  })
})
