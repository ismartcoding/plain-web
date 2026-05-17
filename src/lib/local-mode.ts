import { LOCAL_CLIENT_ID } from '@/stores/device-sessions'

export const LOCAL_FEATURE_IDS = ['chat']
export const LOCAL_ROUTE_GROUPS = ['home', ...LOCAL_FEATURE_IDS]

export function isLocalFeatureId(id: string): boolean {
  return LOCAL_FEATURE_IDS.includes(id)
}

export function isLocalRouteGroup(group: unknown): boolean {
  return typeof group === 'string' && LOCAL_ROUTE_GROUPS.includes(group)
}

/**
 * Local mode: Tauri app running without a connected Android device session.
 * Checks the persisted currentClientId directly so it works before Pinia
 * is initialised (e.g. in router.ts, api.ts).
 */
export function isLocalMode(): boolean {
  if (!__IS_TAURI__) return false
  const raw = localStorage.getItem('device_sessions')
  if (!raw) return true
  try {
    const p = JSON.parse(raw)
    const cid = typeof p.currentClientId === 'string' ? p.currentClientId : ''
    return cid === LOCAL_CLIENT_ID
  } catch {
    return true
  }
}
