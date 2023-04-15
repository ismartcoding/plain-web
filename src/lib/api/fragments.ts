import gql from 'graphql-tag'

export const tagFragment = gql`
  fragment TagFragment on Tag {
    id
    name
  }
`

export const playlistAudioFragment = gql`
  fragment PlaylistAudioFragment on PlaylistAudio {
    title
    artist
    path
    duration
  }
`

export const appFragment = gql`
  fragment AppFragment on App {
    usbConnected
    fileIdToken
    externalFilesDir
    deviceName
    battery
    locale
    theme
    version
    permissions
    audios {
      ...PlaylistAudioFragment
    }
    audioCurrent
    audioMode
    allowSensitivePermissions
  }
  ${playlistAudioFragment}
`
export const wgFragment = gql`
  fragment WireGuardFragment on WireGuard {
    isActive
    isEnabled
    id
    config
    listeningPort
    peers {
      publicKey
      latestHandshake
      txBytes
      rxBytes
      endpoint
    }
  }
`

export const networkConfigFragment = gql`
  fragment NetworkConfigFragment on NetworkConfig {
    netplan
    netmix
  }
`
export const hostapdFragment = gql`
  fragment HostapdFragment on Hostapd {
    isActive
    isEnabled
    config
  }
`

export const deviceFragment = gql`
  fragment DeviceFragment on Device {
    id
    name
    mac
    ip4
    macVendor
    isOnline
    createdAt
    updatedAt
    activeAt
  }
`

export const configFragment = gql`
  fragment ConfigFragment on Config {
    id
    group
    value
    createdAt
    updatedAt
  }
`

export const networkFragment = gql`
  fragment NetworkFragment on Network {
    name
    ifName
    type
  }
`

export const chatItemFragment = gql`
  fragment ChatItemFragment on ChatItem {
    id
    isMe
    createdAt
    content
    _content @client
    data {
      ... on MessageImages {
        ids
      }
      ... on MessageFiles {
        ids
      }
    }
  }
`

export const messageFragment = gql`
  fragment MessageFragment on Message {
    id
    body
    address
    serviceCenter
    date
    type
    tags {
      ...TagFragment
    }
  }
  ${tagFragment}
`
export const contactFragment = gql`
  fragment ContactFragment on Contact {
    id
    suffix
    prefix
    firstName
    middleName
    lastName
    updatedAt
    notes
    source
    thumbnailId
    starred
    phoneNumbers {
      label
      value
      type
      normalizedNumber
    }
    addresses {
      ...ContentItemFagment
    }
    emails {
      ...ContentItemFagment
    }
    websites {
      ...ContentItemFagment
    }
    events {
      ...ContentItemFagment
    }
    ims {
      ...ContentItemFagment
    }
    tags {
      ...TagFragment
    }
  }
  ${tagFragment}
  fragment ContentItemFagment on ContentItem {
    label
    value
    type
  }
`
export const callFragment = gql`
  fragment CallFragment on Call {
    id
    name
    number
    duration
    accountId
    startedAt
    photoId
    type
    geo {
      isp
      city
      province
    }
    tags {
      ...TagFragment
    }
  }
  ${tagFragment}
`

export const fileFragment = gql`
  fragment FileFragment on File {
    path
    isDir
    updatedAt
    size
  }
`

export const imageFragment = gql`
  fragment ImageFragment on Image {
    id
    title
    path
    size
    tags {
      ...TagFragment
    }
  }
  ${tagFragment}
`

export const videoFragment = gql`
  fragment VideoFragment on Video {
    id
    title
    path
    duration
    size
    tags {
      ...TagFragment
    }
  }
  ${tagFragment}
`

export const audioFragment = gql`
  fragment AudioFragment on Audio {
    id
    title
    artist
    path
    duration
    size
    tags {
      ...TagFragment
    }
  }
  ${tagFragment}
`

export const noteFragment = gql`
  fragment NoteFragment on Note {
    id
    title
    content
    deletedAt
    createdAt
    updatedAt
    tags {
      ...TagFragment
    }
  }
  ${tagFragment}
`

export const feedFragment = gql`
  fragment FeedFragment on Feed {
    id
    name
    url
    createdAt
    updatedAt
  }
`

export const feedEntryFragment = gql`
  fragment FeedEntryFragment on FeedEntry {
    id
    title
    url
    image
    author
    description
    content
    feedId
    rawId
    publishedAt
    createdAt
    updatedAt
    tags {
      ...TagFragment
    }
  }
  ${tagFragment}
`


export const aiChatFragment = gql`
  fragment AIChatFragment on AIChat {
    id
    parentId
    isMe
    content
    type
    createdAt
    updatedAt
    tags {
      ...TagFragment
    }
  }
  ${tagFragment}
`
