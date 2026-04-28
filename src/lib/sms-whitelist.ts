const SMS_WHITELIST: Set<string> = new Set([
  // --- Generic & AOSP (The "Must-haves") ---
  'com.android.mms', // Standard AOSP / Generic Android
  'com.google.android.apps.messaging', // Google Messages (Pixel/Nexus/Modern Moto)
  'foundation.e.message', // /e/OS Default
  'com.moez.QKSMS', // QKSMS (Base for many privacy ROMs)

  // --- Major Manufacturers (OEMs) ---
  'com.samsung.android.messaging', // Samsung
  'com.android.mms.service', // Samsung Service
  'com.xiaomi.messaging', // Xiaomi (MIUI/HyperOS)
  'com.hicloud.android.clone', // Huawei (sometimes handles sync)
  'com.huawei.message', // Huawei
  'com.sonyericsson.conversations', // Sony Xperia
  'com.htc.messaging', // HTC
  'com.lge.messaging', // LG

  // --- Popular Third-Party Apps ---
  'com.microsoft.android.smsorganizer', // Microsoft SMS Organizer
  'com.textra', // Textra
  'com.p1.chompsms', // Chomp SMS
  'org.fossify.messages', // Fossify (New)
  'com.simplemobiletools.messages', // Simple Messages (Old)
  'xyz.klinker.messenger', // Pulse SMS
  'com.handcent.nextsms', // Handcent Next SMS
  'com.jb.gosms', // GO SMS Pro
  'org.thoughtcrime.securesms', // Signal (when used as SMS provider)
])

export function shouldTriggerRefresh(notification: { appId: string }): boolean {
  if (SMS_WHITELIST.has(notification.appId)) return true

  // Fallback: many system SMS apps embed "mms" in their package name
  if (notification.appId.includes('mms')) return true

  return false
}
