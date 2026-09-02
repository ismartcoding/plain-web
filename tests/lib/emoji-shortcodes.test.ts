import { describe, expect, it } from 'vitest'
import {
  applyEmojiSuggestion,
  findActiveEmojiShortcode,
  getEmojiSuggestions,
  replaceCompletedEmojiShortcode,
} from '@/lib/emoji-shortcodes'

describe('emoji shortcodes', () => {
  it('finds a shortcode at the caret after whitespace', () => {
    expect(findActiveEmojiShortcode('hello :smi', 10)).toEqual({
      start: 6,
      end: 10,
      query: 'smi',
    })
  })

  it('does not treat URL schemes or times as emoji shortcodes', () => {
    expect(findActiveEmojiShortcode('https://example.com', 6)).toBeNull()
    expect(findActiveEmojiShortcode('Meet at 10:', 11)).toBeNull()
  })

  it('ranks exact and prefix matches before substring matches', () => {
    const suggestions = getEmojiSuggestions('smile')
    expect(suggestions[0]).toMatchObject({ emoji: '😄', shortcode: 'smile' })
    expect(suggestions.some((item) => item.shortcode.includes('smile'))).toBe(true)
  })

  it('offers popular emoji after a bare colon', () => {
    const suggestions = getEmojiSuggestions('')
    expect(suggestions).toHaveLength(8)
    expect(suggestions[0]).toMatchObject({ emoji: '👍', shortcode: 'thumbsup' })
  })

  it('applies a selected suggestion without disturbing surrounding text', () => {
    const active = findActiveEmojiShortcode('before :hea after', 11)
    expect(active).not.toBeNull()
    expect(applyEmojiSuggestion('before :hea after', active!, { emoji: '❤️', shortcode: 'heart' })).toEqual({
      value: 'before ❤️ after',
      caret: 9,
    })
  })

  it('converts a completed shortcode at the caret', () => {
    expect(replaceCompletedEmojiShortcode('Hello :tada: world', 12)).toEqual({
      value: 'Hello 🎉 world',
      caret: 8,
    })
  })

  it('leaves unknown completed shortcodes unchanged', () => {
    expect(replaceCompletedEmojiShortcode(':plainapp:', 10)).toBeNull()
  })
})
