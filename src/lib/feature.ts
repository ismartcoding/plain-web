import { FEATURE } from '@/lib/data'
import { isQPlus, isRPlus } from '@/lib/sdk-version'

export const hasFeature = (feature: FEATURE, osVersion: number) => {
  if (feature === FEATURE.MEDIA_TRASH) {
    return isRPlus(osVersion)
  } else if (feature === FEATURE.MIRROR_AUDIO) {
    return isQPlus(osVersion)
  }

  return false
}
