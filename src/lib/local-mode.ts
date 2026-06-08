import { isLocalMode as _isLocalMode } from '@/lib/device-current'

export { isLocalMode } from '@/lib/device-current'

export const LOCAL_FEATURE_IDS = ['chat']
export const LOCAL_ROUTE_GROUPS = ['home', 'developer', ...LOCAL_FEATURE_IDS]

export function isLocalFeatureId(id: string): boolean {
  return LOCAL_FEATURE_IDS.includes(id)
}

export function isLocalRouteGroup(group: unknown): boolean {
  return typeof group === 'string' && LOCAL_ROUTE_GROUPS.includes(group)
}

// Local mode is a desktop-only affordance — the user explicitly opts into a
// device-less session from the Tauri app's device switcher / tab bar. In a
// regular web build there is no Rust local server and no device to switch to,
// so treating "no bound device" as an authenticated local session would just
// drop unauthenticated visitors onto the chat screen instead of /login.
// Always gate "skip login / show local-mode UI" through this helper.
export function isLocalModeAllowed(): boolean {
  return __IS_TAURI__ && _isLocalMode()
}