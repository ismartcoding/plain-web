import gql from 'graphql-tag'

export const tagFragment = gql`
  fragment TagFragment on Tag {
    id
    name
    count
  }
`

export const tagSubFragment = gql`
  fragment TagSubFragment on Tag {
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
    urlToken
    httpPort
    httpsPort
    externalFilesDir
    deviceName
    battery
    appVersion
    osVersion
    channel
    permissions
    audios {
      ...PlaylistAudioFragment
    }
    audioCurrent
    audioMode
    sdcardPath
    usbDiskPaths
    internalStoragePath
    downloadsDir
    developerMode
    favoriteFolders {
      rootPath
      fullPath
      alias
    }
    customChatFolder
  }
  ${playlistAudioFragment}
`
export const chatItemFragment = gql`
  fragment ChatItemFragment on ChatItem {
    id
    fromId
    toId
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
      ... on MessageText {
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
    threadId
    subscriptionId
    isMms
    attachments {
      path
      contentType
      name
    }
    tags {
      ...TagSubFragment
    }
  }
  ${tagSubFragment}
`

export const messageConversationFragment = gql`
  fragment MessageConversationFragment on MessageConversation {
    id
    address
    snippet
    date
    messageCount
    read
  }
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
      ...TagSubFragment
    }
  }
  ${tagSubFragment}
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
      ...TagSubFragment
    }
  }
  ${tagSubFragment}
`

export const fileFragment = gql`
  fragment FileFragment on File {
    path
    isDir
    createdAt
    updatedAt
    size
    children
    mediaId
  }
`

export const imageFragment = gql`
  fragment ImageFragment on Image {
    id
    title
    path
    size
    bucketId
    createdAt
    updatedAt
    tags {
      ...TagSubFragment
    }
  }
  ${tagSubFragment}
`

export const videoFragment = gql`
  fragment VideoFragment on Video {
    id
    title
    path
    duration
    size
    bucketId
    createdAt
    updatedAt
    tags {
      ...TagSubFragment
    }
  }
  ${tagSubFragment}
`

export const audioFragment = gql`
  fragment AudioFragment on Audio {
    id
    title
    artist
    path
    duration
    size
    bucketId
    albumFileId
    createdAt
    updatedAt
    tags {
      ...TagSubFragment
    }
  }
  ${tagSubFragment}
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
      ...TagSubFragment
    }
  }
  ${tagSubFragment}
`

export const feedFragment = gql`
  fragment FeedFragment on Feed {
    id
    name
    url
    fetchContent
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
      ...TagSubFragment
    }
  }
  ${tagSubFragment}
`

export const packageFragment = gql`
  fragment PackageFragment on Package {
    id
    name
    type
    version
    path
    size
    certs {
      issuer
      subject
      serialNumber
      validFrom
      validTo
    }
    installedAt
    updatedAt
  }
`

export const notificationFragment = gql`
  fragment NotificationFragment on Notification {
    id
    onlyOnce
    isClearable
    appId
    appName
    time
    silent
    title
    body
    actions
  }
`

export const deviceInfoFragment = gql`
  fragment DeviceInfoFragment on DeviceInfo {
    deviceName
    releaseBuildVersion
    versionCodeName
    manufacturer
    securityPatch
    bootloader
    deviceId
    model
    product
    fingerprint
    hardware
    radioVersion
    device
    board
    displayVersion
    buildBrand
    buildHost
    buildTime
    uptime
    buildUser
    serial
    osVersion
    language
    sdkVersion
    javaVmVersion
    kernelVersion
    glEsVersion
    screenDensity
    screenHeight
    screenWidth
    phoneNumbers {
      id
      name
      number
    }
  }
`
