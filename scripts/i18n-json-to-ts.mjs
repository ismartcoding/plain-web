/**
 * i18n-json-to-ts.mjs
 *
 * Reads every .json file in .crowdin/ (downloaded by the Crowdin action) and
 * writes the corresponding src/locales/<locale>.ts file, preserving the
 * `export default { … }` TypeScript module format.
 *
 * Usage:
 *   node scripts/i18n-json-to-ts.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

const crowdinDir = path.resolve('.crowdin')
const localesDir = path.resolve('src/locales')

/**
 * Recursively formats a plain object into a TypeScript object literal string.
 * Strings are single-quoted with inner single-quotes escaped.
 */
function formatValue(val, indent) {
  if (typeof val === 'string') {
    // escape backslashes first, then single quotes, then preserve \n literals
    const escaped = val.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')
    return `'${escaped}'`
  }
  if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
    const inner = Object.entries(val)
      .map(([k, v]) => {
        // numeric string keys need to be quoted
        const key = /^\d+$/.test(k) ? k : k
        return `${indent}  ${key}: ${formatValue(v, indent + '  ')},`
      })
      .join('\n')
    return `{\n${inner}\n${indent}}`
  }
  return JSON.stringify(val)
}

function jsonToTs(obj) {
  const lines = Object.entries(obj).map(([k, v]) => `  ${k}: ${formatValue(v, '  ')},`)
  return `export default {\n${lines.join('\n')}\n}\n`
}

const crowdinFiles = fs.readdirSync(crowdinDir).filter((f) => f.endsWith('.json') && f !== 'en-US.json')

if (crowdinFiles.length === 0) {
  console.log('No translated JSON files found in .crowdin/ — nothing to do.')
  process.exit(0)
}

for (const file of crowdinFiles) {
  const locale = path.basename(file, '.json') // e.g. "de", "zh-CN"
  const jsonPath = path.join(crowdinDir, file)
  const tsPath = path.join(localesDir, `${locale}.ts`)

  // Only update locales that already exist in the repo
  if (!fs.existsSync(tsPath)) {
    console.warn(`Skipping ${locale} — ${tsPath} does not exist`)
    continue
  }

  const obj = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
  const tsContent = jsonToTs(obj)
  fs.writeFileSync(tsPath, tsContent, 'utf8')
  console.log(`Updated ${tsPath}`)
}
