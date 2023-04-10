import type { WgConfigObject, WgConfigInterface, WgConfigPeer } from './data'

interface FindPartInStringOptions {
  string: string
  part: string
}

const findPartInString = ({ string, part }: FindPartInStringOptions) => {
  const parts = string.split('\n')
  const wantedParts = parts.filter((x) => x.includes(part))

  if (!wantedParts.length) return undefined
  const values = wantedParts
    .map((x) => x.match(/((?<==).)(.+$)/gm)?.[0]?.trim())
    .filter((x) => x !== undefined) as string[]

  if (!values.length) return undefined
  return values as [string, ...string[]]
}

export const generateConfigString = (conf: WgConfigObject) => {
  const s: string[] = []
  const { wgInterface, peers } = conf
  const { address, privateKey, listenPort, name, dns, mtu, table, preUp, postUp, preDown, postDown } = wgInterface

  // add interface
  s.push('[Interface]')
  if (name !== undefined) s.push(`#app:Name = ${name}`)
  if (address !== undefined && address.length) s.push(`Address = ${address.join(',')}`)
  if (privateKey) s.push(`PrivateKey = ${privateKey}`)
  if (listenPort) s.push(`ListenPort = ${listenPort}`)
  if (dns && dns.length) s.push(`DNS = ${dns.join(',')}`)
  if (mtu) s.push(`MTU = ${mtu}`)
  if (table) s.push(`Table = ${table}`)
  if (preUp && preUp.length) s.push(preUp.map((x) => `PreUp = ${x}`).join('\n'))
  if (postUp && postUp.length) s.push(postUp.map((x) => `PostUp = ${x}`).join('\n'))
  if (preDown && preDown.length) s.push(preDown.map((x) => `PreDown = ${x}`).join('\n'))
  if (postDown && postDown.length) s.push(postDown.map((x) => `PostDown = ${x}`).join('\n'))

  // add peers
  if (peers?.length) {
    peers.forEach((peer) => {
      s.push('')
      s.push('[Peer]')
      if (peer.name) s.push(`#app:Name = ${peer.name}`)
      if (peer.privateKey) s.push(`#app:PrivateKey = ${peer.privateKey}`)
      if (peer.publicKey) s.push(`PublicKey = ${peer.publicKey}`)
      if (peer.allowedIps && peer.allowedIps.length) s.push(`AllowedIPs = ${peer.allowedIps.join(',')}`)
      if (peer.endpoint) s.push(`Endpoint = ${peer.endpoint}`)
      if (peer.preSharedKey) s.push(`PresharedKey = ${peer.preSharedKey}`)
      if (peer.persistentKeepalive) s.push(`PersistentKeepalive = ${peer.persistentKeepalive}`)
    })
  }
  return s.join('\n')
}

/**
 * Parse a WireGuard config file (wg0.conf) into a WgConfig object for use in Javascript-land
 * If no valid interface is found in the config, it will throw an error
 * If a peer in the peers array is invalid, it will throw an error
 */
export const parseConfigString = (configString: string) => {
  const interFaceReg = /\[Interface\][^\[]*/gm
  const peerReg = /\[Peer\][^\[]*/gm

  const interfaces = configString.match(interFaceReg)
  const interfaceString = interfaces?.[0]
  if (!interfaceString) throw { code: 'no_valid_interface', message: `No interface found in config:\n${configString}` }

  const maybeAddress = findPartInString({ string: interfaceString, part: 'Address' })?.[0]?.split(',')
  const address = maybeAddress ? (maybeAddress.filter((x) => x !== undefined) as [string, ...string[]]) : undefined
  if (!address || !address.length)
    throw { code: 'no_valid_interface', message: `No address found in config:\n${configString}` }

  const privateKey = findPartInString({ string: interfaceString, part: 'PrivateKey' })?.[0]
  if (!privateKey) throw { code: 'no_valid_interface', message: `No privateKey found in config:\n${configString}` }

  const maybeListenPort = findPartInString({ string: interfaceString, part: 'ListenPort' })?.[0]
  const listenPort = maybeListenPort ? parseInt(maybeListenPort) : undefined

  const maybeMTU = findPartInString({ string: interfaceString, part: 'MTU' })?.[0]
  const mtu = maybeMTU ? parseInt(maybeMTU) : undefined

  const maybeDns = findPartInString({ string: interfaceString, part: 'DNS' })?.[0]
    ?.split(',')
    .filter((x) => x !== undefined)
  const dns = maybeDns?.length ? maybeDns : undefined

  const wgInterface: WgConfigInterface = {
    address,
    privateKey,
    dns,
    listenPort,
    mtu,
    name: findPartInString({ string: interfaceString, part: 'app:Name' })?.[0],
    table: findPartInString({ string: interfaceString, part: 'Table' })?.[0],
    preUp: findPartInString({ string: interfaceString, part: 'PreUp' }),
    postUp: findPartInString({ string: interfaceString, part: 'PostUp' }),
    preDown: findPartInString({ string: interfaceString, part: 'PreDown' }),
    postDown: findPartInString({ string: interfaceString, part: 'PostDown' }),
  }

  // remove any undefined keys
  let key: keyof WgConfigInterface
  for (key in wgInterface) if (wgInterface[key] === undefined) delete wgInterface[key]

  const peerStrings = configString.match(peerReg)

  const peers = !peerStrings
    ? []
    : (peerStrings
        .map((x) => {
          if (!x) return undefined

          const maybeAllowedIps = findPartInString({ string: x, part: 'AllowedIPs' })?.[0]?.split(',')
          const allowedIps = maybeAllowedIps
            ? (maybeAllowedIps.filter((y) => y !== undefined) as [string, ...string[]])
            : undefined
          if (!allowedIps || !allowedIps.length)
            throw { code: 'invalid_peer', message: `No allowedIps found in peer:\n${x}` }

          const publicKey = findPartInString({ string: x, part: 'PublicKey' })?.[0]
          if (!publicKey) throw { code: 'invalid_peer', message: `No publicKey found in peer:\n${x}` }

          const maybePersistentKeepAlive = findPartInString({
            string: interfaceString,
            part: 'PersistentKeepalive',
          })?.[0]
          const persistentKeepalive = maybePersistentKeepAlive ? parseInt(maybePersistentKeepAlive) : undefined

          const peer: WgConfigPeer = {
            // required keys
            allowedIps,
            publicKey,
            // optional keys
            persistentKeepalive,
            name: findPartInString({ string: x, part: 'app:Name' })?.[0],
            privateKey: findPartInString({ string: x, part: 'app:PrivateKey' })?.[0],
            endpoint: findPartInString({ string: x, part: 'Endpoint' })?.[0],
            preSharedKey: findPartInString({ string: x, part: 'PresharedKey' })?.[0],
          }

          // remove undefined keys
          let peerKey: keyof WgConfigPeer
          for (peerKey in peer) if (peer[peerKey] === undefined) delete peer[peerKey]

          return peer
        })
        .filter((x) => x !== undefined) as WgConfigPeer[])

  const returnVal: Pick<WgConfigObject, 'peers' | 'wgInterface'> = {
    wgInterface,
    peers,
  }

  return returnVal
}
