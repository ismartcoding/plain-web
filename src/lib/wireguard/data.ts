export interface WgConfigInterface {
  name?: string
  address: string[]
  listenPort?: number
  privateKey: string
  dns?: string[]
  table?: string
  mtu?: number
  preUp?: string[]
  postUp?: string[]
  preDown?: string[]
  postDown?: string[]
}

export interface WgConfigPeer {
  name?: string
  endpoint?: string
  allowedIps?: string[]
  privateKey?: string
  publicKey?: string
  persistentKeepalive?: number
  preSharedKey?: string
}

export interface WgConfigObject {
  wgInterface: WgConfigInterface
  peers: WgConfigPeer[]
  publicKey?: string
  preSharedKey?: string
}
