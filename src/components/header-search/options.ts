import type { IBucket, IFeed, ITag } from '@/lib/interfaces'

export function fileSizeOptions(t: (key: string) => string) {
  return [
    { value: '>1048576', label: '> 1MB', description: t('search_file_size_greater_than_1mb') },
    { value: '>10485760', label: '> 10MB', description: t('search_file_size_greater_than_10mb') },
    { value: '>104857600', label: '> 100MB', description: t('search_file_size_greater_than_100mb') },
    { value: '>1073741824', label: '> 1GB', description: t('search_file_size_greater_than_1gb') },
    { value: '<1048576', label: '< 1MB', description: t('search_file_size_less_than_1mb') },
    { value: '<102400', label: '< 100KB', description: t('search_file_size_less_than_100kb') },
  ]
}

export function keyOptionsForGroup(group: string, hasHistory: boolean): string[] {
  const withHistory = (keys: string[]) => (hasHistory ? ['history', ...keys] : keys)

  switch (group) {
    case 'audios':
    case 'videos':
    case 'images':
      return withHistory(['tag', 'bucket'])
    case 'apps':
      return withHistory(['type'])
    case 'files':
      return withHistory(['file_size'])
    case 'messages':
      return withHistory(['type', 'tag'])
    case 'calls':
      return withHistory(['type', 'duration', 'start_time'])
    case 'feeds':
      return withHistory(['feed_id'])
    default:
      return hasHistory ? ['history'] : []
  }
}

export function valueOptionsForGroup(opts: {
  group: string
  t: (key: string) => string
  history: any[]
  mediaTags: ITag[]
  mediaBuckets: IBucket[]
  feeds: IFeed[]
  messageTags?: ITag[]
}) {
  const base: Record<string, any[]> = {}
  if ((opts.history ?? []).length > 0) base.history = opts.history

  if (opts.group === 'audios' || opts.group === 'videos' || opts.group === 'images') {
    base.tag = (opts.mediaTags ?? []).map((t) => t.name)
    base.bucket = [...(opts.mediaBuckets ?? [])]
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', undefined, { numeric: true, sensitivity: 'base' }))
      .map((b) => b.name)
  }

  if (opts.group === 'apps') {
    base.type = [
      { value: 'user', label: opts.t('app_type.user') },
      { value: 'system', label: opts.t('app_type.system') },
    ]
  }

  if (opts.group === 'files') {
    base.file_size = fileSizeOptions(opts.t)
  }

  if (opts.group === 'messages') {
    base.type = [
      { value: '1', label: opts.t('message_type.1') },
      { value: '2', label: opts.t('message_type.2') },
      { value: '3', label: opts.t('message_type.3') },
    ]
    base.tag = (opts.messageTags ?? []).map((t) => t.name)
  }

  if (opts.group === 'calls') {
    base.type = [
      { value: '1', label: opts.t('call_type.1') },
      { value: '2', label: opts.t('call_type.2') },
      { value: '3', label: opts.t('call_type.3') },
    ]
    base.duration = [
      { value: '>=60', label: '>= 1m' },
      { value: '>=300', label: '>= 5m' },
      { value: '>=1800', label: '>= 30m' },
      { value: '>=3600', label: '>= 1h' },
    ]
    base.start_time = []
  }

  if (opts.group === 'feeds') {
    base.feed_id = (opts.feeds ?? []).map((f) => ({ value: f.id, label: f.name }))
  }

  return base
}
