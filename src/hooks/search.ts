import type { IFilter } from '@/lib/interfaces'
import { buildQuery, parseQuery, type IFilterField } from '@/lib/search'
import { decodeBase64, encodeBase64 } from '@/lib/strutil'
import type { LocationQuery } from 'vue-router'

export const useSearch = () => {
  return {
    copyFilter: (from: IFilter, to: IFilter) => {
      to.text = from.text
      to.feedId = from.feedId
      to.tagIds = [...from.tagIds]
      to.bucketId = from.bucketId
      to.today = from.today
      to.type = from.type
      to.trash = from.trash
    },
    parseQ: (filter: IFilter, q: string) => {
      const fields = parseQuery(q)
      filter.tagIds = []
      filter.text = undefined
      filter.feedId = undefined
      filter.today = undefined
      filter.bucketId = undefined
      filter.type = undefined
      filter.trash = undefined
      fields.forEach((it) => {
        if (it.name === 'text') {
          filter.text = it.value
        } else if (it.name === 'feed_id') {
          filter.feedId = it.value
        } else if (it.name === 'tag_id') {
          filter.tagIds.push(it.value)
        } else if (it.name === 'today') {
          filter.today = it.value === 'true'
        } else if (it.name === 'bucket_id') {
          filter.bucketId = it.value
        } else if (it.name === 'type') {
          filter.type = it.value
        } else if (it.name === 'trash') {
          filter.trash = it.value === 'true'
        }
      })
    },
    buildQ: (filter: IFilter): string => {
      const fields: IFilterField[] = []
      if (filter.bucketId) {
        fields.push({
          name: 'bucket_id',
          op: '',
          value: filter.bucketId,
        })
      }

      if (filter.today === true) {
        fields.push({
          name: 'today',
          op: '',
          value: 'true',
        })
      }

      if (filter.trash !== undefined) {
        fields.push({
          name: 'trash',
          op: '',
          value: filter.trash ? 'true' : 'false',
        })
      }

      if (filter.type) {
        fields.push({
          name: 'type',
          op: '',
          value: filter.type,
        })
      }

      if (filter.feedId) {
        fields.push({
          name: 'feed_id',
          op: '',
          value: filter.feedId,
        })
      }

      for (const id of filter.tagIds) {
        fields.push({
          name: 'tag_id',
          op: '',
          value: id,
        })
      }

      if (filter.text) {
        fields.push({
          name: 'text',
          op: '',
          value: filter.text,
        })
      }

      return encodeBase64(buildQuery(fields))
    },
  }
}

export const parseTagId = (query: LocationQuery) => {
  const tagIds: string[] = []
  const fields = parseQuery(decodeBase64(query.q?.toString() ?? ''))
  fields.forEach((it) => {
    if (it.name === 'tag_id') {
      tagIds.push(it.value)
    }
  })
  return tagIds.length === 1 ? tagIds[0] : ''
}
