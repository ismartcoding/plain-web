export interface AgentVersionInfo {
  name: string
  version: string
  majorVersion: number
}
export type AgentOSInfo = AgentVersionInfo

export interface AgentBrowserInfo extends AgentVersionInfo {
  webkit: boolean
  webkitVersion: string
  chromium: boolean
  chromiumVersion: string
  webview: boolean
}

export interface AgentInfo {
  browser: AgentBrowserInfo
  os: AgentOSInfo
  isMobile: boolean
  isHints: boolean
}

export interface PresetInfo {
  test: string
  id: string
  brand?: boolean
  versionTest?: string
  versionAlias?: string
}
export interface PresetResult {
  preset: PresetInfo | null
  version: string
}

export interface NavigatorUABrandVersion {
  brand: string
  version: string
}

export interface UADataValues {
  platform: string
  platformVersion: string
  architecture: string
  model: string
  uaFullVersion: string
  fullVersionList: NavigatorUABrandVersion[]
}
export interface NavigatorUAData {
  brands?: NavigatorUABrandVersion[]
  mobile: boolean
  platform: string
  getHighEntropyValues<T extends keyof UADataValues>(
    hints: readonly T[]
  ): Promise<{
    [key in T]: UADataValues[key]
  }>
}
