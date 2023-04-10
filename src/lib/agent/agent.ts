import type { AgentInfo } from './types'
import { hasUserAgentData } from './utils'
import { getClientHintsAgent } from './userAgentData'
import { getLegacyAgent } from './userAgent'

export async function getAccurateAgent(): Promise<AgentInfo> {
  if (hasUserAgentData()) {
    const info = await navigator.userAgentData.getHighEntropyValues([
      'architecture',
      'model',
      'platform',
      'platformVersion',
      'uaFullVersion',
      'fullVersionList',
    ])
    return getClientHintsAgent(info)
  }

  return agent()
}

function agent(userAgent?: string): AgentInfo {
  if (typeof userAgent === 'undefined' && hasUserAgentData()) {
    return getClientHintsAgent()
  } else {
    return getLegacyAgent(userAgent)
  }
}
export { getLegacyAgent }

export default agent

export * from './types'
