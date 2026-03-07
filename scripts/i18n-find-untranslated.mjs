/**
 * i18n-find-untranslated.mjs
 *
 * Compares every locale against en-US and writes scripts/i18n-todo.json
 * with two lists per locale:
 *   - missing : keys present in en-US but absent in the locale
 *   - english : keys whose value is identical to en-US and looks like
 *               real English (not brand names, acronyms, or format-only)
 *
 * Usage:
 *   node scripts/i18n-find-untranslated.mjs
 */
import ts from 'typescript'
import fs from 'node:fs'
import path from 'node:path'

// ──────────────────────────────────────────────
// Locale file helpers
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

function flatten(obj, prefix = '') {
  const out = new Map()
  for (const [k, v] of Object.entries(obj ?? {})) {
    const key = prefix ? `${prefix}.${k}` : k
    if (isPlainObject(v)) {
      for (const [kk, vv] of flatten(v, key)) out.set(kk, vv)
    } else {
      out.set(key, v)
    }
  }
  return out
}

// ──────────────────────────────────────────────
// "Looks like English text that needs translation"
// Exclude: all-caps acronyms, pure numbers, short tech tokens,
//          strings that are only placeholders / symbols
// ──────────────────────────────────────────────
function looksLikeUntranslatedEnglish(value) {
  if (typeof value !== 'string') return false
  const v = value.trim()
  if (v.length <= 2) return false
  // Only numbers / symbols
  if (!/[a-zA-Z]/.test(v)) return false
  // All uppercase and short  → acronym/abbreviation (JSON, CSV, MMS, HD …)
  if (/^[A-Z0-9\s\/\-_\.]+$/.test(v) && v.length <= 8) return false
  // Looks like a URL / file path
  if (/^https?:\/\//.test(v)) return false
  // Pure placeholder like "{count}"
  if (/^\{[^}]+\}$/.test(v)) return false
  // Contains at least one 3-letter run of ASCII lowercase → real English word
  return /[a-z]{3}/.test(v)
}

// ──────────────────────────────────────────────
// locale → Google Translate language code
// ──────────────────────────────────────────────
const langMap = {
  'bn.ts': 'bn',
  'de.ts': 'de',
  'es.ts': 'es',
  'fr.ts': 'fr',
  'hi.ts': 'hi',
  'it.ts': 'it',
  'ja.ts': 'ja',
  'ko.ts': 'ko',
  'nl.ts': 'nl',
  'pt.ts': 'pt',
  'ru.ts': 'ru',
  'ta.ts': 'ta',
  'tr.ts': 'tr',
  'vi.ts': 'vi',
  'zh-CN.ts': 'zh-CN',
  'zh-TW.ts': 'zh-TW',
}

// ──────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────
const localesDir = path.resolve('src/locales')
const baseFile = path.join(localesDir, 'en-US.ts')
const baseFlat = flatten(loadLocale(baseFile))

// Load stable cache (keys confirmed correct as English loanwords/brand names)
const stableFile = path.resolve('scripts/i18n-stable.json')
const stable = fs.existsSync(stableFile)
  ? JSON.parse(fs.readFileSync(stableFile, 'utf8'))
  : {}

const files = fs.readdirSync(localesDir).filter((f) => f.endsWith('.ts') && f !== 'en-US.ts')

const todo = {}
let totalMissing = 0
let totalEnglish = 0

for (const f of files) {
  const lang = langMap[f]
  if (!lang) continue

  const locFlat = flatten(loadLocale(path.join(localesDir, f)))

  const stableKeys = stable[f] ?? []
  const missing = []
  const english = []

  for (const [k, enVal] of baseFlat) {
    if (stableKeys.includes(k)) continue  // confirmed loanword/brand name
    const locVal = locFlat.get(k)
    if (locVal === undefined || locVal === null) {
      missing.push({ key: k, en: enVal })
    } else if (String(locVal) === String(enVal) && looksLikeUntranslatedEnglish(String(enVal))) {
      english.push({ key: k, en: enVal })
    }
  }

  if (missing.length + english.length === 0) continue

  todo[f] = { lang, missing, english }
  totalMissing += missing.length
  totalEnglish += english.length
  console.log(`${f}: ${missing.length} missing, ${english.length} untranslated (English)`)
}

const outFile = path.resolve('scripts/i18n-todo.json')
fs.writeFileSync(outFile, JSON.stringify(todo, null, 2), 'utf8')
console.log(`\nTotal: ${totalMissing} missing, ${totalEnglish} untranslated`)
console.log(`Written to ${outFile}`)
