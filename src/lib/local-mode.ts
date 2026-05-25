import { LOCAL_CLIENT_ID } from '@/stores/device-sessions'
import { get as prefsGet } from '@/lib/prefs'

export const LOCAL_FEATURE_IDS = ['chat']
export const LOCAL_ROUTE_GROUPS = ['home', ...LOCAL_FEATURE_IDS]

export function isLocalFeatureId(id: string): boolean {
  return LOCAL_FEATURE_IDS.includes(id)
}

export function isLocalRouteGroup(group: unknown): boolean {
  return typeof group === 'string' && LOCAL_ROUTE_GROUPS.includes(group)
}

export function isLocalMode(): boolean {
  if (!__IS_TAURI__) return false
  try {
    const p = prefsGet<{ currentClientId?: string } | null>('device_sessions', null)
    const cid = typeof p?.currentClientId === 'string' ? p.currentClientId : ''
    return !cid || cid === LOCAL_CLIENT_ID
  } catch {
    return true
  }
}
