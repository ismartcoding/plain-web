import { buildQuery, parseQuery } from '@/lib/search'
import { decodeBase64, encodeBase64 } from '@/lib/strutil'

export type ParsedField = { name: string; op: string; value: string }

export function parseCurrentFields(encodedQ: string | undefined): ParsedField[] {
  if (!encodedQ) return []
  try {
    return parseQuery(decodeBase64(encodedQ))
  } catch {
    return []
  }
}

export function decodedQuery(encodedQ: string | undefined): string {
  if (!encodedQ) return ''
  try {
    return decodeBase64(encodedQ)
  } catch {
    return ''
  }
}

export function splitOpValue(raw: string) {
  const s = String(raw ?? '').trim()
  const match = s.match(/^([><=!]+)?(.+)$/)
  if (!match) return { op: '', value: '' }
  return { op: match[1] || '', value: (match[2] || '').trim() }
}

export function encodeFields(fields: ParsedField[]) {
  if (fields.length === 0) return ''
  return encodeBase64(buildQuery(fields))
}
