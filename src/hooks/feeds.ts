import type { IFeed } from '@/lib/interfaces'
import { buildQuery } from '@/lib/search'
import { encodeBase64 } from '@/lib/strutil'
import { replacePath } from '@/plugins/router'

export const useFeeds = (mainStore: any) => {
  return {
    viewAll: () => {
      replacePath(mainStore, '/feeds')
    },
    viewFeed: (item: IFeed) => {
      const q = buildQuery([
        {
          name: 'feed_id',
          op: '',
          value: item.id,
        },
      ])
      replacePath(mainStore, `/feeds?q=${encodeBase64(q)}`)
    },
    viewToday: () => {
      const q = buildQuery([
        {
          name: 'today',
          op: '',
          value: 'true',
        },
      ])
      replacePath(mainStore, `/feeds?q=${encodeBase64(q)}`)
    },
  }
}
