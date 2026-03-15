/**
 * i18n-find-untranslated.mjs
 *
 * Compares every locale against en-US and writes scripts/i18n-todo.json
 * with two lists per locale:
 *   - missing : keys present in en-US but absent in the locale
 *   - english : keys whose value is identical to en-US and looks like
 *               real English (not brand names, acronyms, or format-only)
 *
 * Supports directory-based locales: src/locales/<locale>/{module}.ts
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
function loadSingleFile(file) {
  const src = fs.readFileSync(file, 'utf8')
  const out = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  }).outputText
  return new Function(out.replace(/export\s+default\s+/, 'return '))()
}

function loadLocaleDir(dir) {
  const moduleFiles = fs.readdirSync(dir).filter(f => f.endsWith('.ts') && f !== 'index.ts')
  const merged = {}
  for (const mf of moduleFiles) {
    Object.assign(merged, loadSingleFile(path.join(dir, mf)))
  }
  return merged
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
// Supported locale codes (directory name = Google Translate lang code)
// ──────────────────────────────────────────────
const SUPPORTED_LOCALES = new Set([
  'bn', 'de', 'es', 'fr', 'hi', 'it', 'ja', 'ko',
  'nl', 'pt', 'ru', 'ta', 'tr', 'vi', 'zh-CN', 'zh-TW',
])

// ──────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────
const localesDir = path.resolve('src/locales')
const baseDir = path.join(localesDir, 'en-US')
const baseFlat = flatten(loadLocaleDir(baseDir))

// Load stable cache (keys confirmed correct as English loanwords/brand names)
const stableFile = path.resolve('scripts/i18n-stable.json')
const stable = fs.existsSync(stableFile)
  ? JSON.parse(fs.readFileSync(stableFile, 'utf8'))
  : {}

// Find locale directories (everything except en-US)
const localeDirs = fs.readdirSync(localesDir).filter((d) => {
  return d !== 'en-US' && fs.statSync(path.join(localesDir, d)).isDirectory() && SUPPORTED_LOCALES.has(d)
})

const todo = {}
let totalMissing = 0
let totalEnglish = 0

for (const locale of localeDirs) {
  const locFlat = flatten(loadLocaleDir(path.join(localesDir, locale)))

  const stableKeys = stable[locale] ?? []
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

  todo[locale] = { lang: locale, missing, english }
  totalMissing += missing.length
  totalEnglish += english.length
  console.log(`${locale}: ${missing.length} missing, ${english.length} untranslated (English)`)
}

const outFile = path.resolve('scripts/i18n-todo.json')
fs.writeFileSync(outFile, JSON.stringify(todo, null, 2), 'utf8')
console.log(`\nTotal: ${totalMissing} missing, ${totalEnglish} untranslated`)
console.log(`Written to ${outFile}`)
