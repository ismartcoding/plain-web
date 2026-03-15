/**
 * i18n-json-to-ts.mjs
 *
 * Reads every .json file in .crowdin/ (downloaded by the Crowdin action) and
 * writes the corresponding src/locales/<locale>/{module}.ts files, using
 * en-US module structure to determine key → module assignment.
 *
 * Usage:
 *   node scripts/i18n-json-to-ts.mjs
 */
import ts from 'typescript'
import fs from 'node:fs'
import path from 'node:path'

const crowdinDir = path.resolve('.crowdin')
const localesDir = path.resolve('src/locales')
const enUSDir = path.join(localesDir, 'en-US')

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
function loadSingleFile(file) {
  const src = fs.readFileSync(file, 'utf8')
  const out = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  }).outputText
  return new Function(out.replace(/export\s+default\s+/, 'return '))()
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

function isPlainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v)
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

// Build key → module map from en-US
function getKeyToModuleMap() {
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

const INDEX_CONTENT = `const modules = import.meta.glob(['./*.ts', '!./index.ts'], { eager: true, import: 'default' })
export default Object.assign({}, ...(Object.values(modules) as any[]))
`

// ──────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────
const crowdinFiles = fs.readdirSync(crowdinDir).filter((f) => f.endsWith('.json') && f !== 'en-US.json')

if (crowdinFiles.length === 0) {
  console.log('No translated JSON files found in .crowdin/ — nothing to do.')
  process.exit(0)
}

const keyToModule = getKeyToModuleMap()

for (const file of crowdinFiles) {
  const locale = path.basename(file, '.json') // e.g. "de", "zh-CN"
  const localeDir = path.join(localesDir, locale)

  // Only update locales that already exist
  if (!fs.existsSync(localeDir)) {
    console.warn(`Skipping ${locale} — ${localeDir} does not exist`)
    continue
  }

  const obj = JSON.parse(fs.readFileSync(path.join(crowdinDir, file), 'utf8'))

  // Split into modules
  const modules = {}
  for (const [key, value] of Object.entries(obj)) {
    const mod = keyToModule[key] || 'common'
    if (!modules[mod]) modules[mod] = {}
    modules[mod][key] = value
  }

  // Write each module file
  for (const [modName, modObj] of Object.entries(modules)) {
    const moduleFile = path.join(localeDir, `${modName}.ts`)
    fs.writeFileSync(moduleFile, `export default ${formatObject(modObj, 0)}\n`, 'utf8')
  }

  // Ensure index.ts exists
  const indexFile = path.join(localeDir, 'index.ts')
  if (!fs.existsSync(indexFile)) {
    fs.writeFileSync(indexFile, INDEX_CONTENT, 'utf8')
  }

  console.log(`Updated ${localeDir} (${Object.keys(modules).length} modules)`)
}
