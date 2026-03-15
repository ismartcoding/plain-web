/**
 * i18n-ts-to-json.mjs
 *
 * Converts src/locales/en-US/ (directory of module .ts files) into
 * .crowdin/en-US.json so that Crowdin can pick it up as the source file.
 *
 * Usage:
 *   node scripts/i18n-ts-to-json.mjs
 */
import ts from 'typescript'
import fs from 'node:fs'
import path from 'node:path'

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

const outDir = path.resolve('.crowdin')
fs.mkdirSync(outDir, { recursive: true })

const localesDir = path.resolve('src/locales')
const enUSDir = path.join(localesDir, 'en-US')
const obj = loadLocaleDir(enUSDir)

const json = JSON.stringify(obj, null, 2)
const outFile = path.join(outDir, 'en-US.json')
fs.writeFileSync(outFile, json, 'utf8')
console.log(`Written ${outFile}`)
