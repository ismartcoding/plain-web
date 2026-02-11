import sjcl from 'sjcl'

export function arrayBufferFromBits(arr: sjcl.BitArray): ArrayBuffer {
  let out, i

  if (arr.length === 0) {
    return new ArrayBuffer(0)
  }

  const ol = sjcl.bitArray.bitLength(arr) / 8

  //check to make sure the bitLength is divisible by 8, if it isn't
  //we can't do anything since arraybuffers work with bytes, not bits
  if (sjcl.bitArray.bitLength(arr) % 8 !== 0) {
    throw new sjcl.exception.invalid('Invalid bit size, must be divisble by 8 to fit in an arraybuffer correctly')
  }

  //padded temp for easy copying
  const tmp = new DataView(new ArrayBuffer(arr.length * 4))
  for (i = 0; i < arr.length; i++) {
    tmp.setUint32(i * 4, arr[i] << 32) //get rid of the higher bits
  }

  //now copy the final message if we are not going to 0 pad
  out = new DataView(new ArrayBuffer(ol))

  //save a step when the tmp and out bytelength are ===
  if (out.byteLength === tmp.byteLength) {
    return tmp.buffer
  }

  const smallest = tmp.byteLength < out.byteLength ? tmp.byteLength : out.byteLength
  for (i = 0; i < smallest; i++) {
    out.setUint8(i, tmp.getUint8(i))
  }

  return out.buffer
}

export function arrayBuffertoBits(buffer: ArrayBuffer) {
  if (buffer.byteLength === 0) {
    return []
  }

  const out = []
  let tmp
  const inView = new DataView(buffer)
  const len = inView.byteLength - (inView.byteLength % 4)

  for (let i = 0; i < len; i += 4) {
    out.push(inView.getUint32(i))
  }

  if (inView.byteLength % 4 != 0) {
    tmp = new DataView(new ArrayBuffer(4))
    for (let i = 0, l = inView.byteLength % 4; i < l; i++) {
      //we want the data to the right, because partial slices off the starting bits
      tmp.setUint8(i + 4 - l, inView.getUint8(len + i)) // big-endian,
    }
    out.push(sjcl.bitArray.partial((inView.byteLength % 4) * 8, tmp.getUint32(0)))
  }

  return out
}

export function parseWebSocketData(buffer: ArrayBuffer): { type: number; data: any } {
  const out = []
  let tmp

  let prefix = 0

  if (buffer.byteLength === 0) {
    return {
      type: 0,
      data: [],
    }
  }

  const inView = new DataView(buffer)
  prefix = inView.getInt32(0)
  const len = inView.byteLength - (inView.byteLength % 4)

  for (let i = 0; i < len; i += 4) {
    if (i === 0) {
      continue
    }
    out.push(inView.getUint32(i))
  }

  if (inView.byteLength % 4 != 0) {
    tmp = new DataView(new ArrayBuffer(4))
    for (let i = 0, l = inView.byteLength % 4; i < l; i++) {
      //we want the data to the right, because partial slices off the starting bits
      tmp.setUint8(i + 4 - l, inView.getUint8(len + i)) // big-endian,
    }
    out.push(sjcl.bitArray.partial((inView.byteLength % 4) * 8, tmp.getUint32(0)))
  }

  return {
    type: prefix,
    data: out,
  }
}
