#!/usr/bin/env node
/**
 * Remove one or more translation keys from all locale files.
 *
 * Usage:
 *   node scripts/i18n-remove-key.mjs <key> [key2 ...]
 *
 * Examples:
 *   node scripts/i18n-remove-key.mjs old_feature_key
 *   node scripts/i18n-remove-key.mjs in_sidebar not_in_sidebar all_features_added
 *
 * Supports nested keys with dot notation:
 *   node scripts/i18n-remove-key.mjs page_title.books
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const localesDir = join(__dirname, '../src/locales')

const keysToRemove = process.argv.slice(2)

if (keysToRemove.length === 0) {
  console.error('Usage: node scripts/i18n-remove-key.mjs <key> [key2 ...]')
  console.error('Example: node scripts/i18n-remove-key.mjs old_key another_key')
  process.exit(1)
}

/**
 * Remove a simple (non-nested) top-level key from a TypeScript locale file string.
 * Handles single-line entries like:  key: 'value',
 */
function removeTopLevelKey(source, key) {
  // Match:  key: '...' or key: "..." possibly spanning one line, with trailing comma
  const re = new RegExp(`^[ \\t]+${escapeRegex(key)}:[ \\t]+'[^']*',?\\r?\\n`, 'gm')
  let result = source.replace(re, '')
  // Also try double-quoted
  const re2 = new RegExp(`^[ \\t]+${escapeRegex(key)}:[ \\t]+"[^"]*",?\\r?\\n`, 'gm')
  result = result.replace(re2, '')
  return result
}

/**
 * Remove a nested key (e.g. "page_title.books") — removes only the inner line inside the object.
 */
function removeNestedKey(source, parentKey, childKey) {
  // Find the parent object block and remove the child line within it
  const re = new RegExp(
    `([ \\t]+${escapeRegex(parentKey)}:[ \\t]*\\{[^}]*)` +
    `[ \\t]+${escapeRegex(childKey)}:[ \\t]+(?:'[^']*'|"[^"]*"),?\\r?\\n`,
    's'
  )
  return source.replace(re, '$1')
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function processFile(filePath, keys) {
  let source = readFileSync(filePath, 'utf8')
  let modified = false

  for (const key of keys) {
    const original = source
    if (key.includes('.')) {
      const [parent, child] = key.split('.', 2)
      source = removeNestedKey(source, parent, child)
    } else {
      source = removeTopLevelKey(source, key)
    }
    if (source !== original) modified = true
  }

  if (modified) {
    writeFileSync(filePath, source, 'utf8')
    return true
  }
  return false
}

// Find all locale .ts files (not index.ts)
function findLocaleFiles(dir) {
  const results = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      for (const file of readdirSync(full)) {
        if (file.endsWith('.ts') && file !== 'index.ts') {
          results.push(join(full, file))
        }
      }
    }
  }
  return results
}

const files = findLocaleFiles(localesDir)
let updatedCount = 0

for (const file of files) {
  const updated = processFile(file, keysToRemove)
  if (updated) {
    console.log(`✓ Updated: ${file.replace(join(__dirname, '..') + '/', '')}`)
    updatedCount++
  }
}

console.log(`\nDone. Updated ${updatedCount}/${files.length} files for key(s): ${keysToRemove.join(', ')}`)
