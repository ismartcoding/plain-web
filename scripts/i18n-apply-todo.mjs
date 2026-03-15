/**
 * i18n-apply-todo.mjs
 *
 * Reads scripts/i18n-translated.json and patches every locale's module files:
 *   - Missing keys are inserted at their proper nested position
 *   - Keys that were still English are replaced in-place
 *
 * Supports directory-based locales: src/locales/<locale>/{module}.ts
 * Uses en-US modules to determine which module file a key belongs to.
 *
 * Usage:
 *   node scripts/i18n-apply-todo.mjs
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

function setPath(obj, keyPath, value) {
  const parts = keyPath.split('.')
  let cur = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]
    if (!isPlainObject(cur[part])) cur[part] = {}
    cur = cur[part]
  }
  cur[parts[parts.length - 1]] = value
}

// ──────────────────────────────────────────────
// Formatter  (produces the canonical .ts style)
// ──────────────────────────────────────────────
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
// Build key → module mapping from en-US directory
// ──────────────────────────────────────────────
function getKeyToModuleMap(enUSDir) {
  const map = {}
  const moduleFiles = fs.readdirSync(enUSDir).filter(f => f.endsWith('.ts') && f !== 'index.ts')
  for (const mf of moduleFiles) {
    const obj = loadSingleFile(path.join(enUSDir, mf))
    const modName = path.basename(mf, '.ts')
    for (const key of Object.keys(obj)) {
      map[key] = modName
    }
  }
  return map
}

// ──────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────
const translatedFile = path.resolve('scripts/i18n-translated.json')
if (!fs.existsSync(translatedFile)) {
  console.error('scripts/i18n-translated.json not found – run i18n-translate-todo.mjs first')
  process.exit(1)
}

const translated = JSON.parse(fs.readFileSync(translatedFile, 'utf8'))
const localesDir = path.resolve('src/locales')
const keyToModule = getKeyToModuleMap(path.join(localesDir, 'en-US'))

let totalApplied = 0
let totalFiles = 0

for (const [locale, { items }] of Object.entries(translated)) {
  if (!items || items.length === 0) continue

  const localeDir = path.join(localesDir, locale)
  if (!fs.existsSync(localeDir)) {
    console.warn(`  Skip ${locale} – directory not found`)
    continue
  }

  // Group items by module
  const moduleItems = {}
  for (const { key, translated: translatedValue } of items) {
    if (translatedValue == null) continue
    const topKey = key.split('.')[0]
    const mod = keyToModule[topKey] || 'common'
    if (!moduleItems[mod]) moduleItems[mod] = []
    moduleItems[mod].push({ key, translated: translatedValue })
  }

  let localeChanged = 0

  for (const [mod, modItems] of Object.entries(moduleItems)) {
    const moduleFile = path.join(localeDir, `${mod}.ts`)
    const obj = fs.existsSync(moduleFile) ? loadSingleFile(moduleFile) : {}

    for (const { key, translated: translatedValue } of modItems) {
      setPath(obj, key, translatedValue)
      localeChanged++
    }

    fs.writeFileSync(moduleFile, `export default ${formatObject(obj, 0)}\n`, 'utf8')
  }

  if (localeChanged === 0) continue

  console.log(`[${locale}] applied ${localeChanged} translations`)
  totalApplied += localeChanged
  totalFiles++
}

console.log(`\n✓ ${totalApplied} keys applied across ${totalFiles} locales`)
