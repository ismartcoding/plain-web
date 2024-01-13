function gf(init?: number[]): Float64Array {
  const r = new Float64Array(16)
  if (init) {
    for (let i = 0; i < init.length; ++i) r[i] = init[i]
  }
  return r
}

function pack(o: Uint8Array | number[], n: Float64Array | number[]) {
  let b,
    m = gf(),
    t = gf()
  for (var i = 0; i < 16; ++i) t[i] = n[i]
  carry(t)
  carry(t)
  carry(t)
  for (let j = 0; j < 2; ++j) {
    m[0] = t[0] - 0xffed
    for (var i = 1; i < 15; ++i) {
      m[i] = t[i] - 0xffff - ((m[i - 1] >> 16) & 1)
      m[i - 1] &= 0xffff
    }
    m[15] = t[15] - 0x7fff - ((m[14] >> 16) & 1)
    b = (m[15] >> 16) & 1
    m[14] &= 0xffff
    cswap(t, m, 1 - b)
  }
  for (var i = 0; i < 16; ++i) {
    o[2 * i] = t[i] & 0xff
    o[2 * i + 1] = t[i] >> 8
  }
}

function carry(o: Float64Array | number[]) {
  let c
  for (let i = 0; i < 16; ++i) {
    o[(i + 1) % 16] += (i < 15 ? 1 : 38) * Math.floor(o[i] / 65536)
    o[i] &= 0xffff
  }
}

function cswap(p: Float64Array | number[], q: Float64Array | number[], b: number) {
  let t,
    c = ~(b - 1)
  for (let i = 0; i < 16; ++i) {
    t = c & (p[i] ^ q[i])
    p[i] ^= t
    q[i] ^= t
  }
}

function add(o: Float64Array | number[], a: any[] | Float64Array, b: any[] | Float64Array) {
  for (let i = 0; i < 16; ++i) o[i] = (a[i] + b[i]) | 0
}

function subtract(o: Float64Array | number[], a: Float64Array | number[], b: Float64Array | number[]) {
  for (let i = 0; i < 16; ++i) o[i] = (a[i] - b[i]) | 0
}

function multmod(o: Float64Array | number[], a: Float64Array | number[], b: Float64Array | number[]) {
  const t = new Float64Array(31)
  for (var i = 0; i < 16; ++i) {
    for (let j = 0; j < 16; ++j) t[i + j] += a[i] * b[j]
  }
  for (var i = 0; i < 15; ++i) t[i] += 38 * t[i + 16]
  for (var i = 0; i < 16; ++i) o[i] = t[i]
  carry(o)
  carry(o)
}

function invert(o: Float64Array | number[], i: Float64Array | number[]) {
  const c = gf()
  for (var a = 0; a < 16; ++a) c[a] = i[a]
  for (var a = 253; a >= 0; --a) {
    multmod(c, c, c)
    if (a !== 2 && a !== 4) multmod(c, c, i)
  }
  for (var a = 0; a < 16; ++a) o[a] = c[a]
}

function clamp(z: Uint8Array | number[]) {
  z[31] = (z[31] & 127) | 64
  z[0] &= 248
}

function generatePublicKey(privateKey: Uint8Array | number[]) {
  let r,
    z = new Uint8Array(32)
  const a = gf([1]),
    b = gf([9]),
    c = gf(),
    d = gf([1]),
    e = gf(),
    f = gf(),
    _121665 = gf([0xdb41, 1]),
    _9 = gf([9])
  for (var i = 0; i < 32; ++i) z[i] = privateKey[i]
  clamp(z)
  for (var i = 254; i >= 0; --i) {
    r = (z[i >>> 3] >>> (i & 7)) & 1
    cswap(a, b, r)
    cswap(c, d, r)
    add(e, a, c)
    subtract(a, a, c)
    add(c, b, d)
    subtract(b, b, d)
    multmod(d, e, e)
    multmod(f, a, a)
    multmod(a, c, a)
    multmod(c, b, e)
    add(e, a, c)
    subtract(a, a, c)
    multmod(b, a, a)
    subtract(c, d, f)
    multmod(a, c, _121665)
    add(a, a, d)
    multmod(c, c, a)
    multmod(a, d, f)
    multmod(d, b, _9)
    multmod(b, e, e)
    cswap(a, b, r)
    cswap(c, d, r)
  }
  invert(c, c)
  multmod(a, a, c)
  pack(z, a)
  return z
}

function generatePresharedKey() {
  const privateKey = new Uint8Array(32)
  crypto.getRandomValues(privateKey)
  return privateKey
}

function generatePrivateKey() {
  const privateKey = generatePresharedKey()
  clamp(privateKey)
  return privateKey
}

function encodeBase64(dest: Uint8Array | number[], src: Uint8Array | number[]) {
  const input = Uint8Array.from([(src[0] >> 2) & 63, ((src[0] << 4) | (src[1] >> 4)) & 63, ((src[1] << 2) | (src[2] >> 6)) & 63, src[2] & 63])
  for (let i = 0; i < 4; ++i) dest[i] = input[i] + 65 + (((25 - input[i]) >> 8) & 6) - (((51 - input[i]) >> 8) & 75) - (((61 - input[i]) >> 8) & 15) + (((62 - input[i]) >> 8) & 3)
}

function keyToBase64(key: any) {
  let i,
    base64 = new Uint8Array(44)
  for (i = 0; i < 32 / 3; ++i) encodeBase64(base64.subarray(i * 4), key.subarray(i * 3))
  encodeBase64(base64.subarray(i * 4), Uint8Array.from([key[i * 3 + 0], key[i * 3 + 1], 0]))
  base64[43] = 61
  return new TextDecoder().decode(base64)
}

export const generateKeypair = () => {
  const privateKey = generatePrivateKey()
  const publicKey = generatePublicKey(privateKey)
  return {
    publicKey: keyToBase64(publicKey),
    privateKey: keyToBase64(privateKey),
  }
}
