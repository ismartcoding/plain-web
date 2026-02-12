import ts from 'typescript'
import fs from 'node:fs'
import path from 'node:path'

function loadLocale(file) {
  const src = fs.readFileSync(file, 'utf8')
  const out = ts.transpileModule(src, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText

  const wrapped = out.replace(/export\s+default\s+/, 'return ')
   
  return new Function(wrapped)()
}

function isPlainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

function flatten(obj, prefix = '') {
  const out = new Map()
  for (const [k, v] of Object.entries(obj ?? {})) {
    const key = prefix ? `${prefix}.${k}` : k
    if (isPlainObject(v)) {
      for (const [kk, vv] of flatten(v, key).entries()) out.set(kk, vv)
    } else {
      out.set(key, v)
    }
  }
  return out
}

function getPath(obj, keyPath) {
  const parts = keyPath.split('.')
  let cur = obj
  for (const part of parts) {
    if (!isPlainObject(cur) || !(part in cur)) return undefined
    cur = cur[part]
  }
  return cur
}

function setPath(obj, keyPath, value) {
  const parts = keyPath.split('.')
  let cur = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]
    const next = cur[part]
    if (!isPlainObject(next)) cur[part] = {}
    cur = cur[part]
  }
  cur[parts[parts.length - 1]] = value
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
  if (Array.isArray(value)) {
    const items = value.map((v) => formatValue(v, indentLevel + 1))
    return `[${items.join(', ')}]`
  }
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

const webLocalesDir = path.resolve('src/locales')
const nasLocalesDir = path.resolve('../plainnas/web/src/locales')

const baseFile = path.join(webLocalesDir, 'en-US.ts')
const baseObj = loadLocale(baseFile)
const baseFlat = flatten(baseObj)

const files = fs.readdirSync(webLocalesDir).filter((f) => f.endsWith('.ts'))

let touched = 0
for (const f of files) {
  if (f === 'en-US.ts') continue

  const webFile = path.join(webLocalesDir, f)
  const localeObj = loadLocale(webFile)
  const localeFlat = flatten(localeObj)

  const nasFile = path.join(nasLocalesDir, f)
  const nasFlat = fs.existsSync(nasFile) ? flatten(loadLocale(nasFile)) : new Map()

  let changed = false

  for (const k of baseFlat.keys()) {
    if (localeFlat.has(k)) continue

    const fromNas = nasFlat.get(k)
    const fromBase = baseFlat.get(k)
    const value = fromNas ?? fromBase

    if (value === undefined) continue

    setPath(localeObj, k, value)
    changed = true
  }

  if (!changed) continue

  const out = `export default ${formatObject(localeObj, 0)}\n`
  fs.writeFileSync(webFile, out, 'utf8')
  touched++
}
