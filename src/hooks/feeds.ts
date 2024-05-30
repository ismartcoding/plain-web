import type { IFeed } from '@/lib/interfaces'
import { buildQuery } from '@/lib/search'
import { encodeBase64 } from '@/lib/strutil'
import { replacePath } from '@/plugins/router'
import { kebabCase } from 'lodash-es'

export const useFeeds = (mainStore: any) => {
  return {
    viewFeed: (item: IFeed) => {
      const q = buildQuery([
        {
          name: 'feed',
          op: '',
          value: kebabCase(item.name),
        },
      ])
      replacePath(mainStore, `/feeds?q=${encodeBase64(q)}`)
    },
  }
}
