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
  // eslint-disable-next-line no-new-func
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

const localesDir = path.resolve('src/locales')
const files = fs.readdirSync(localesDir).filter((f) => f.endsWith('.ts'))
const baseFile = path.join(localesDir, 'en-US.ts')

const base = flatten(loadLocale(baseFile))

const report = {}
for (const f of files) {
  if (f === 'en-US.ts') continue
  const full = path.join(localesDir, f)
  const loc = flatten(loadLocale(full))

  const missing = []
  for (const k of base.keys()) {
    if (!loc.has(k)) missing.push(k)
  }

  const extra = []
  for (const k of loc.keys()) {
    if (!base.has(k)) extra.push(k)
  }

  report[f] = {
    missingCount: missing.length,
    extraCount: extra.length,
    missing,
    extra,
  }
}

console.log(JSON.stringify(report, null, 2))
