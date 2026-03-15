/**
 * i18n-split.mjs
 *
 * One-time migration: splits monolithic locale .ts files into
 * per-feature module files organized in directories.
 *
 * Before: src/locales/en-US.ts  (single ~670-line file)
 * After:  src/locales/en-US/{index,common,device,...}.ts
 *
 * Usage:
 *   node scripts/i18n-split.mjs
 */
import ts from 'typescript'
import fs from 'node:fs'
import path from 'node:path'

// ──────────────────────────────────────────────
// Key → Module mapping
// Top-level keys mapped to their module filename (without .ts).
// Any key NOT listed here falls into 'common'.
// ──────────────────────────────────────────────
const KEY_TO_MODULE = {
  // ── login ──
  password: 'login',
  log_in: 'login',
  logging_in: 'login',
  login: 'login',

  // ── device ──
  device_info: 'device',
  basic_info: 'device',
  device_name: 'device',
  model: 'device',
  device: 'device',
  board: 'device',
  hardware: 'device',
  brand: 'device',
  build_fingerprint: 'device',
  system: 'device',
  android_version: 'device',
  security_patch: 'device',
  bootloader: 'device',
  build_number: 'device',
  baseband: 'device',
  kernel: 'device',
  java_vm: 'device',
  opengl_es: 'device',
  uptime: 'device',
  battery: 'device',
  health: 'device',
  level: 'device',
  remaining: 'device',
  power_source: 'device',
  technology: 'device',
  temperature: 'device',
  voltage: 'device',
  capacity: 'device',
  battery_health: 'device',
  battery_status: 'device',
  battery_plugged: 'device',
  battery_left: 'device',
  manufacturer: 'device',
  mac_address: 'device',
  ip_address: 'device',
  device_type: 'device',
  port: 'device',
  paired_devices: 'device',
  unpaired_devices: 'device',
  listening_port: 'device',

  // ── messages (SMS / MMS) ──
  write_a_message: 'messages',
  send_sms: 'messages',
  send_mms: 'messages',
  mms_large_file_warning: 'messages',
  mms_image_auto_compress: 'messages',
  mms_cancelled: 'messages',
  export_sms: 'messages',
  export_format_json: 'messages',
  export_format_text: 'messages',
  export_format_csv: 'messages',
  export_format_note: 'messages',
  export_loading_messages: 'messages',
  export_preparing_data: 'messages',
  export_fetching_attachments: 'messages',
  export_generating_zip: 'messages',
  sent: 'messages',
  received: 'messages',
  direction: 'messages',
  attachment: 'messages',
  attachments: 'messages',
  body: 'messages',
  message_type: 'messages',
  sms_address: 'messages',
  messages: 'messages',
  confirm_mms_on_phone: 'messages',
  type_a_reply: 'messages',

  // ── contacts (& calls) ──
  call: 'contacts',
  select_contact: 'contacts',
  call_phone: 'contacts',
  phone_numbers: 'contacts',
  telephone: 'contacts',
  custom: 'contacts',
  website: 'contacts',
  email: 'contacts',
  phone_number: 'contacts',
  add_field: 'contacts',
  im: 'contacts',
  contact: 'contacts',
  call_type: 'contacts',
  first_name: 'contacts',
  last_name: 'contacts',
  middle_name: 'contacts',
  prefix: 'contacts',
  suffix: 'contacts',
  contacts: 'contacts',
  social: 'contacts',
  calls: 'contacts',
  phone_geo: 'contacts',
  avatar: 'contacts',
  phone_isp_type: 'contacts',
  make_a_phone_call: 'contacts',

  // ── files (& storage) ──
  upload_failed: 'files',
  release_to_send_files: 'files',
  storage: 'files',
  files: 'files',
  storage_free_total: 'files',
  current_path: 'files',
  select_folder: 'files',
  create_folder: 'files',
  upload_files: 'files',
  upload_folder: 'files',
  upload_select_destination: 'files',
  upload_select_destination_desc: 'files',
  upload: 'files',
  download: 'files',
  choose_download_method: 'files',
  download_individually: 'files',
  download_as_zip: 'files',
  show_hidden: 'files',
  select_mode: 'files',
  file_size: 'files',
  upload_status: 'files',
  delete_files: 'files',
  delete_file: 'files',
  recents: 'files',
  internal_storage: 'files',
  sdcard: 'files',
  recent_files: 'files',
  usb_storage: 'files',
  folders: 'files',
  volumes: 'files',
  app_data: 'files',
  file_not_found: 'files',
  access_denied: 'files',
  failed_to_load_file: 'files',
  invalid_file_id: 'files',
  invalid_file_path: 'files',
  invalid_file_signature: 'files',
  raw_text: 'files',
  formatted_view: 'files',
  invalid_json_format: 'files',

  // ── media (audio / video / images) ──
  audio_player: 'media',
  play: 'media',
  add_to_playlist: 'media',
  added_to_playlist: 'media',
  playlist: 'media',
  remove_from_playlist: 'media',
  music: 'media',
  videos: 'media',
  images: 'media',
  audios: 'media',
  artist: 'media',
  view_origin_image: 'media',
  mute: 'media',
  unmute: 'media',
  pausing: 'media',
  play_pause_video: 'media',

  // ── feeds (RSS) ──
  fetch_content_automatically: 'feeds',
  subscriptions: 'feeds',
  published_at: 'feeds',
  source: 'feeds',
  view_original_article: 'feeds',
  add_subscription: 'feeds',
  import_opml_file: 'feeds',
  export_opml_file: 'feeds',
  rss_url: 'feeds',
  imported: 'feeds',
  update_subscription: 'feeds',
  sync_feeds: 'feeds',
  sync_content: 'feeds',
  feeds_synced: 'feeds',
  syncing: 'feeds',
  meta_no_title: 'feeds',
  no_content: 'feeds',
  feed: 'feeds',

  // ── search ──
  search_hint: 'search',
  keywords: 'search',
  search: 'search',
  search_key_hidden: 'search',
  search_key_history: 'search',
  search_filter_by_tag: 'search',
  search_filter_by_folder: 'search',
  search_filter_in_trash: 'search',
  search_filter_show_hidden: 'search',
  search_filter_by_file_size: 'search',
  search_filter_by_duration: 'search',
  search_filter_by_start_time: 'search',
  search_calendar_select_date: 'search',
  search_file_size_greater_than_1mb: 'search',
  search_file_size_greater_than_10mb: 'search',
  search_file_size_greater_than_100mb: 'search',
  search_file_size_greater_than_1gb: 'search',
  search_file_size_less_than_1mb: 'search',
  search_file_size_less_than_100kb: 'search',
  search_no_results: 'search',

  // ── mirror (screen mirror & remote control) ──
  screenshot: 'mirror',
  mirror_quality: 'mirror',
  mirror_auto: 'mirror',
  mirror_hd: 'mirror',
  mirror_smooth: 'mirror',
  mirror_audio: 'mirror',
  mirror_audio_no_permission: 'mirror',
  mirror_audio_not_supported: 'mirror',
  confirm_mirror_audio_permission_on_phone: 'mirror',
  resolution: 'mirror',
  exit_fullscreen: 'mirror',
  screen_mirror: 'mirror',
  stop_mirror: 'mirror',
  fullscreen: 'mirror',
  screen_mirror_request_permission_failed: 'mirror',
  screen_mirror_request_permission: 'mirror',
  remote_control: 'mirror',
  enable_control: 'mirror',
  disable_control: 'mirror',
  control_enabled: 'mirror',
  nav_back: 'mirror',
  nav_home: 'mirror',
  nav_recents: 'mirror',
  nav_lock_screen: 'mirror',
  accessibility_service_required: 'mirror',
  accessibility_step_1: 'mirror',
  accessibility_step_2: 'mirror',
  accessibility_step_3: 'mirror',
  accessibility_note: 'mirror',
  accessibility_not_enabled: 'mirror',
  start_recording: 'mirror',
  stop_recording: 'mirror',
  recording: 'mirror',
  recording_no_stream: 'mirror',
  recording_not_supported: 'mirror',
  recording_failed: 'mirror',
  mirror_tap: 'mirror',
  mirror_swipe: 'mirror',
  mirror_scroll: 'mirror',
  mirror_long_press: 'mirror',

  // ── chat (& channels) ──
  send_to_phone_clipboard: 'chat',
  clipboard_text: 'chat',
  my_phone: 'chat',
  me: 'chat',
  chat_input_hint: 'chat',
  delete_message: 'chat',
  chat_info: 'chat',
  clear_messages: 'chat',
  clear_messages_confirm: 'chat',
  messages_cleared: 'chat',
  channels: 'chat',
  create_channel: 'chat',
  channel_name: 'chat',
  rename_channel: 'chat',
  delete_channel: 'chat',
  delete_channel_confirm: 'chat',
  leave_channel: 'chat',
  leave_channel_confirm: 'chat',
  channel_info: 'chat',
  channel_members: 'chat',
  add_member: 'chat',
  remove_member: 'chat',
  member_joined: 'chat',
  member_pending: 'chat',
  accept_invite: 'chat',
  decline_invite: 'chat',
  channel_invite: 'chat',
  channel_invite_desc: 'chat',
  new_chat: 'chat',
  ai: 'chat',
  config: 'chat',
  api_key: 'chat',
  no_api_key: 'chat',

  // ── apps ──
  confirm_uninstallation_on_phone: 'apps',
  app_type: 'apps',
  apps: 'apps',
  version: 'apps',
  installed_at: 'apps',
  uninstalling: 'apps',
  uninstall: 'apps',
  install: 'apps',
  install_app: 'apps',
  app_installation_failed: 'apps',
  app_installation_completed: 'apps',
  app_upgrade_completed: 'apps',
  confirm_installation_on_phone: 'apps',

  // ── bookmarks ──
  bookmarks: 'bookmarks',
  add_bookmarks: 'bookmarks',
  add_bookmarks_hint: 'bookmarks',
  add_bookmarks_placeholder: 'bookmarks',
  add_to_group: 'bookmarks',
  no_bookmarks: 'bookmarks',
  no_bookmarks_in_group: 'bookmarks',
  bookmark_sort_order: 'bookmarks',
  bookmark_sort_recent: 'bookmarks',
  add_bookmark_group: 'bookmarks',
  edit_bookmark: 'bookmarks',
  edit_group: 'bookmarks',
  bookmark_title_placeholder: 'bookmarks',
  ungrouped: 'bookmarks',
  pinned: 'bookmarks',
  pin: 'bookmarks',
  unpin: 'bookmarks',
  export_bookmarks: 'bookmarks',
  import_bookmarks: 'bookmarks',
  clear_bookmarks: 'bookmarks',
  clear_group_bookmarks: 'bookmarks',
  move_to_group: 'bookmarks',
  confirm_delete_bookmark: 'bookmarks',
  confirm_delete_group: 'bookmarks',
  group_name: 'bookmarks',
  group_name_placeholder: 'bookmarks',

  // ── pomodoro ──
  pomodoro_timer: 'pomodoro',
  work_time: 'pomodoro',
  short_break: 'pomodoro',
  long_break: 'pomodoro',
  x_pomodoros: 'pomodoro',
  minutes: 'pomodoro',
  round_n_of_n: 'pomodoro',
  today_completed: 'pomodoro',
  ready_to_start: 'pomodoro',
  work_completed: 'pomodoro',
  break_completed: 'pomodoro',
  time_for_break: 'pomodoro',
  time_for_work: 'pomodoro',
  long_break_time: 'pomodoro',
  short_break_time: 'pomodoro',
  work_time_start: 'pomodoro',
  click_to_adjust: 'pomodoro',

  // ── tags ──
  tag: 'tags',
  tags: 'tags',
  add_to_tags: 'tags',
  remove_from_tags: 'tags',
  select_tags: 'tags',
  add_tag: 'tags',
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
function loadLocale(file) {
  const src = fs.readFileSync(file, 'utf8')
  const out = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  }).outputText
  return new Function(out.replace(/export\s+default\s+/, 'return '))()
}

function isPlainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

function escapeString(s) {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\n|\r/g, '\\n')
    .replace(/'/g, "\\'")
}

function isValidIdentifier(key) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)
}

function formatKey(key) {
  if (/^\d+$/.test(key)) return key
  if (isValidIdentifier(key)) return key
  return `'${escapeString(key)}'`
}

function formatValue(value, indentLevel) {
  if (isPlainObject(value)) return formatObject(value, indentLevel)
  if (Array.isArray(value)) return `[${value.map((v) => formatValue(v, indentLevel + 1)).join(', ')}]`
  if (typeof value === 'string') return `'${escapeString(value)}'`
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value === null || value === undefined) return 'null'
  return `'${escapeString(String(value))}'`
}

function formatObject(obj, indentLevel) {
  const indent = '  '.repeat(indentLevel)
  const childIndent = '  '.repeat(indentLevel + 1)
  const entries = Object.entries(obj)
  if (entries.length === 0) return '{}'
  const lines = ['{']
  for (const [k, v] of entries) {
    lines.push(`${childIndent}${formatKey(k)}: ${formatValue(v, indentLevel + 1)},`)
  }
  lines.push(`${indent}}`)
  return lines.join('\n')
}

// ──────────────────────────────────────────────
// Split a locale object into modules
// ──────────────────────────────────────────────
function splitLocale(obj) {
  const modules = {}
  for (const [key, value] of Object.entries(obj)) {
    const mod = KEY_TO_MODULE[key] || 'common'
    if (!modules[mod]) modules[mod] = {}
    modules[mod][key] = value
  }
  return modules
}

// ──────────────────────────────────────────────
// index.ts template — uses Vite's import.meta.glob
// to auto-discover sibling module files
// ──────────────────────────────────────────────
const INDEX_CONTENT = `const modules = import.meta.glob(['./*.ts', '!./index.ts'], { eager: true, import: 'default' })
export default Object.assign({}, ...(Object.values(modules) as any[]))
`

// ──────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────
const localesDir = path.resolve('src/locales')
const files = fs.readdirSync(localesDir).filter((f) => f.endsWith('.ts') && !f.startsWith('.'))

if (files.length === 0) {
  console.log('No .ts files found in src/locales/ — already split?')
  process.exit(0)
}

for (const file of files) {
  const locale = path.basename(file, '.ts')
  const filePath = path.join(localesDir, file)
  const obj = loadLocale(filePath)
  const modules = splitLocale(obj)

  // Create locale directory
  const localeDir = path.join(localesDir, locale)
  fs.mkdirSync(localeDir, { recursive: true })

  // Write module files
  for (const [moduleName, moduleObj] of Object.entries(modules)) {
    const moduleFile = path.join(localeDir, `${moduleName}.ts`)
    const content = `export default ${formatObject(moduleObj, 0)}\n`
    fs.writeFileSync(moduleFile, content, 'utf8')
  }

  // Write index.ts
  fs.writeFileSync(path.join(localeDir, 'index.ts'), INDEX_CONTENT, 'utf8')

  // Remove old monolithic file
  fs.unlinkSync(filePath)

  const moduleNames = Object.keys(modules).sort()
  console.log(`${locale}: ${moduleNames.length} modules (${moduleNames.join(', ')})`)
}

// Update i18n-stable.json keys: 'bn.ts' → 'bn'
const stableFile = path.resolve('scripts/i18n-stable.json')
if (fs.existsSync(stableFile)) {
  const stable = JSON.parse(fs.readFileSync(stableFile, 'utf8'))
  const updated = {}
  for (const [key, val] of Object.entries(stable)) {
    const newKey = key.replace(/\.ts$/, '')
    updated[newKey] = val
  }
  fs.writeFileSync(stableFile, JSON.stringify(updated, null, 2), 'utf8')
  console.log('\nUpdated scripts/i18n-stable.json keys')
}

console.log('\n✓ Locale files split into modules successfully.')
console.log('Each locale is now a directory with per-feature .ts files + index.ts')
