const flickrBase58 = '123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ'

export const randomUUID = () => {
  const b = crypto.getRandomValues(new Uint8Array(16))

  // Bitwise AND operation followed by OR operator to modify 6th and 8th elements of the array
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80

  // Lowercasing the result after converting each element in hexadecimal format
  const uuid = toHex(b).toLowerCase()

  // Return the string created by extracting substrings from the given result
  return `${uuid.substring(0, 8)}-${uuid.substring(8, 12)}-${uuid.substring(12, 16)}-${uuid.substring(16, 20)}-${uuid.substring(20)}`
}

export const shortUUID = () => {
  const translated = anyBase('0123456789abcdef', flickrBase58, randomUUID().toLowerCase().replace(/-/g, ''))
  const shortIdLength = Math.ceil(Math.log(2 ** 128) / Math.log(flickrBase58.length))
  return translated.padStart(shortIdLength, flickrBase58[0])
}

const toHex = (b: Uint8Array) => {
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
}

export const arrayBufferToHex = (buffer: ArrayBuffer) => {
  return [...new Uint8Array(buffer)].map((x) => x.toString(16).padStart(2, '0')).join('')
}

export const base64ToArrayBuffer = (b64: string) => {
  return stringToArrayBuffer(atob(b64))
}

export const stringToArrayBuffer = (str: string) => {
  const byteArray = new Uint8Array(str.length)
  for (let i = 0; i < str.length; i++) {
    byteArray[i] = str.charCodeAt(i)
  }
  return byteArray
}

export const arrayBufferToBase64 = (buffer: ArrayBufferLike) => {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

export const containsChinese = (str: string) => {
  return /[\u3400-\u9FBF]/.test(str)
}

export function encodeBase64(str: string): string {
  if (!str) {
    return ''
  }

  return btoa(encodeURIComponent(str))
}

export function decodeBase64(str: string): string {
  try {
    return decodeURIComponent(atob(str))
  } catch (err) {
    return str
  }
}

function anyBase(srcAlphabet: string, dstAlphabet: string, number: string) {
  let i,
    divide,
    newlen,
    numberMap = [],
    fromBase = srcAlphabet.length,
    toBase = dstAlphabet.length,
    length = number.length,
    result = ''

  if (srcAlphabet === dstAlphabet) {
    return number
  }

  for (i = 0; i < length; i++) {
    numberMap[i] = srcAlphabet.indexOf(number[i])
  }
  do {
    divide = 0
    newlen = 0
    for (i = 0; i < length; i++) {
      divide = divide * fromBase + numberMap[i]
      if (divide >= toBase) {
        numberMap[newlen++] = parseInt((divide / toBase).toString(), 10)
        divide = divide % toBase
      } else if (newlen > 0) {
        numberMap[newlen++] = 0
      }
    }
    length = newlen
    result = dstAlphabet.slice(divide, divide + 1).concat(result)
  } while (newlen !== 0)

  return result
}

const URL_REGEX = /(\b(((https?|ftp):\/\/)|www.)[A-Z0-9+&@#\/%?=~_|!:,.;-]*[-A-Z0-9+&@#\/%=~_|])/gim
const EMAIL_REGEX = /(\w+@[a-zA-Z_]+?\.[a-zA-Z]{2,6})/gim

export function addLinksToURLs(text: string) {
  let newText = encodeHTML(text)
  newText = newText.replace(URL_REGEX, '<a href="$1" target="_blank">$1</a>')
  newText = newText.replace(EMAIL_REGEX, '<a href="mailto:$1">$1</a>')
  return newText.replace(/\n\r?/g, '<br />')
}

export function encodeHTML(html: string) {
  return html.replace(/[\u00A0-\u9999<>&'"]/gim, function (i) {
    return '&#' + i.charCodeAt(0) + ';'
  })
}


export function getSummary(description: string): string {
  // Define regex to match Markdown image syntax and HTML img tags
  const regex = /!\[.*?\]\(.*?\)|!\[.*?\]\[.*?\]|<img.*?>/gi

  // Replace the matched patterns with an image emoji and trim leading whitespace
  return description.replace(regex, '🖼').replace('\n', '').replace(/^\s*/, '')
}
