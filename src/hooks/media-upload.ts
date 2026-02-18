import type { Ref } from 'vue'
import type { IBucket, IFilter } from '@/lib/interfaces'
import { getDirFromPath } from '@/lib/file'
import { pickUploadDir } from '@/lib/upload/pick-upload-dir'

export function createBucketUploadTarget(options: {
  filter: Pick<IFilter, 'bucketId' | 'trash'>
  buckets: Ref<IBucket[]>
  picker: {
    title: string
    description: string
    initialPath?: string
    modalId: string
    storageKey: string
  }
}) {
  const getSelectedBucketDir = () => {
    const bucketId = options.filter.bucketId
    if (!bucketId) return ''

    const bucket = options.buckets.value.find((it) => it.id === bucketId)
    const top = bucket?.topItems?.[0]
    if (!top) return ''
    return getDirFromPath(top)
  }

  const resolveTargetDir = async (): Promise<string | undefined> => {
    const bucketDir = getSelectedBucketDir()
    if (bucketDir) return bucketDir

    return pickUploadDir({
      title: options.picker.title,
      description: options.picker.description,
      initialPath: options.picker.initialPath || '',
      modalId: options.picker.modalId,
      storageKey: options.picker.storageKey,
    })
  }

  return {
    getSelectedBucketDir,
    resolveTargetDir,
  }
}
