const VERSION_CODES = {
  Q: 29, // Android 10
  R: 30, // Android 11
  S: 31, // Android 12
  S_V2: 32, // Android 12L
  TIRAMISU: 33, // Android 13
  UPSIDE_DOWN_CAKE: 34, // Android 14
}

// Check if the SDK version is at least the specified version
export function isQPlus(version: number) {
  return version >= VERSION_CODES.Q
}

export function isRPlus(version: number) {
  return version >= VERSION_CODES.R
}

export function isSPlus(version: number) {
  return version >= VERSION_CODES.S
}

export function isSV2Plus(version: number) {
  return version >= VERSION_CODES.S_V2
}

export function isTPlus(version: number) {
  return version >= VERSION_CODES.TIRAMISU
}

export function isUPlus(version: number) {
  return version >= VERSION_CODES.UPSIDE_DOWN_CAKE
}
