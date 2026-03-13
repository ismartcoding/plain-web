/**
 * i18n-ts-to-json.mjs
 *
 * Converts src/locales/en-US.ts (the English source file) into
 * .crowdin/en-US.json so that Crowdin can pick it up as the source file.
 *
 * Usage:
 *   node scripts/i18n-ts-to-json.mjs
 */
import ts from 'typescript'
import fs from 'node:fs'
import path from 'node:path'

function loadLocale(file) {
  const src = fs.readFileSync(file, 'utf8')
  const out = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  // strip "use strict" + Object.defineProperty boilerplate and grab the exports.default
  const mod = { exports: {} }
  new Function('module', 'exports', out)(mod, mod.exports)
  return mod.exports.default ?? mod.exports
}

const outDir = path.resolve('.crowdin')
fs.mkdirSync(outDir, { recursive: true })

const localesDir = path.resolve('src/locales')
const src = path.join(localesDir, 'en-US.ts')
const obj = loadLocale(src)

const json = JSON.stringify(obj, null, 2)
const outFile = path.join(outDir, 'en-US.json')
fs.writeFileSync(outFile, json, 'utf8')
console.log(`Written ${outFile}`)
