import { isLocalMode as _isLocalMode } from './current'

export { isLocalMode } from './current'

export const LOCAL_FEATURE_IDS = ['chat', 'image_editor']
export const LOCAL_ROUTE_GROUPS = ['home', 'developer', ...LOCAL_FEATURE_IDS]

export function isLocalFeatureId(id: string): boolean {
  return LOCAL_FEATURE_IDS.includes(id)
}

export function isLocalRouteGroup(group: unknown): boolean {
  return typeof group === 'string' && LOCAL_ROUTE_GROUPS.includes(group)
}

export function isLocalModeAllowed(): boolean {
  return __IS_TAURI__ && _isLocalMode()
}