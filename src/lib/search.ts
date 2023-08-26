import { without, keys, kebabCase } from 'lodash-es'
import { ref } from 'vue'
import type { LocationQuery } from 'vue-router'
import type { IFilter } from './interfaces'
import { decodeBase64 } from './strutil'

export interface IQueryGroup {
  length: number
  field: string
  query: string
  op: string
  value: string
}

const GROUP_DELIMITER = /(?:[^\s"]+|"[^"]*")+/g
const FILTER_DELIMITER = ':'
const NOT_TYPE = 'NOT'
const INVERT: any = {
  '=': '!=',
  '>=': '<',
  '>': '<=',
  '!=': '=',
  '<=': '>',
  '<': '>=',
  in: 'nin',
  nin: 'in',
}
const NUMBER_OPS = ['>', '>=', '<', '<=']
const GROUP_TYPES = without(keys(INVERT), 'in', 'nin')

export function splitInGroup(s: string) {
  return s.match(GROUP_DELIMITER)
}

export function removeQuotation(s: string) {
  return s.replace(/['"]+/g, '')
}

export function detectGroupType(group: string) {
  return GROUP_TYPES.find((it) => group.indexOf(it) === 0) || ''
}

export function splitGroup(q: string): IQueryGroup {
  const parts = q.split(FILTER_DELIMITER)
  const field = removeQuotation(parts[0])
  const query = removeQuotation(parts.slice(1).join(FILTER_DELIMITER))
  const op = detectGroupType(query)
  const value = query.slice(op.length)

  return {
    length: parts.length,
    field: field,
    query: query,
    op: op,
    value: value,
  }
}

export function parseGroup(group: string): IFilterField {
  if (group == NOT_TYPE) {
    return {
      name: '',
      op: NOT_TYPE,
      value: '',
    }
  }

  const parts = splitGroup(group)
  if (parts.field == 'is') {
    return {
      name: parts.query,
      op: '',
      value: 'true',
    }
  } else if (parts.length == 1) {
    return {
      name: 'text',
      op: '',
      value: parts.field,
    }
  } else {
    return {
      name: parts.field,
      op: parts.op,
      value: parts.value,
    }
  }
}

export interface IFilterField {
  name: string
  op: string
  value: string
}

export const parseQuery = (q: string): IFilterField[] => {
  const groups = splitInGroup(q)?.map((it) => parseGroup(it))
  if (!groups) {
    return []
  }
  let invert = false
  groups.forEach((it) => {
    if (it.op == NOT_TYPE) {
      invert = true
    } else if (invert) {
      it.op = INVERT[it.op] || ''
      invert = false
    }
  })

  return groups.filter((it) => it.op !== NOT_TYPE)
}

export const buildQuery = (fileds: IFilterField[]) => {
  const items: string[] = []
  fileds.forEach((it) => {
    const value = it.value
    if (it.name === 'text') {
      if (value.indexOf(' ') !== -1) {
        items.push(`"${value}"`)
      } else {
        items.push(value)
      }
    } else if (value.indexOf(' ') !== -1) {
      items.push(`${it.name}:${it.op}"${value}"`)
    } else {
      items.push(`${it.name}:${it.op}${value}`)
    }
  })

  return items.join(' ')
}

export const parseLocationQuery = (query: LocationQuery) => {
  const q = ref(decodeBase64(query.q?.toString() ?? ''))
  return parseQuery(q.value as string)
}

const parseQueryName = (query: LocationQuery, name: string) => {
  const fields = parseLocationQuery(query)
  if (fields.length === 1) {
    return fields.find((it) => it.name === name)?.value ?? ''
  }
  return ''
}

export const parseTagName = (query: LocationQuery) => {
  return parseQueryName(query, 'tag')
}

export const parseFeedName = (query: LocationQuery) => {
  return parseQueryName(query, 'feed')
}

export const buildFilterQuery = (filter: IFilter): string => {
  const fields: IFilterField[] = []
  if (filter.bucketId){
    fields.push({
      name: 'bucket_id',
      op: '',
      value: filter.bucketId,
    })
  }
    
  for (const tag of filter.tags) {
    fields.push({
      name: 'tag',
      op: '',
      value: kebabCase(tag.name),
    })
  }

  if (filter.text) {
    fields.push({
      name: 'text',
      op: '',
      value: filter.text,
    })
  }
  return buildQuery(fields)
}
