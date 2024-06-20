import { FEATURE } from '@/lib/data'
import { isRPlus } from '@/lib/sdk-version'

export const hasFeature = (feature: FEATURE, osVersion: number) => {
  if (feature === FEATURE.MEDIA_TRASH) {
    return isRPlus(osVersion)
  }

  return false
}
