/**
 * i18n-translate-todo.mjs
 *
 * Reads scripts/i18n-todo.json, translates every item with Google Translate
 * (unofficial free endpoint – no API key required), and writes
 * scripts/i18n-translated.json.
 *
 * Batching: up to BATCH_SIZE strings are sent per request to reduce round-trips.
 * A separator that never appears in translation values is used to join/split.
 *
 * Usage:
 *   node scripts/i18n-translate-todo.mjs
 *
 * Options (env vars):
 *   BATCH_SIZE   – strings per request (default 20)
 *   DELAY_MS     – ms between requests  (default 300)
 */

const BATCH_SIZE = parseInt(process.env.BATCH_SIZE ?? '20', 10)
const DELAY_MS = parseInt(process.env.DELAY_MS ?? '300', 10)
// Separator: uses only digits and symbols — never gets translated as words
const SEP = ' ◆◇◆ '

import fs from 'node:fs'
import path from 'node:path'

const todo = JSON.parse(fs.readFileSync(path.resolve('scripts/i18n-todo.json'), 'utf8'))

// Load (or initialise) the stable cache: keys where the correct translation
// happens to be identical to English (loanwords, brand names, tech terms).
// Format: { "de.ts": ["screenshot", "hardware", ...], ... }
const stableFile = path.resolve('scripts/i18n-stable.json')
const stable = fs.existsSync(stableFile)
  ? JSON.parse(fs.readFileSync(stableFile, 'utf8'))
  : {}

// ──────────────────────────────────────────────
// Google Translate (free, no key)
// Accepts an array of strings, returns translated array in same order.
// ──────────────────────────────────────────────
async function translateBatch(strings, targetLang) {
  // Join with separator; protect i18n placeholders {…} so GT doesn't mangle them
  // Strategy: replace {placeholder} → ⟨N⟩ before translate, restore after
  const placeholderMap = []
  const protect = (s) =>
    s.replace(/\{[^}]+\}/g, (m) => {
      const idx = placeholderMap.length
      placeholderMap.push(m)
      return `⟨${idx}⟩`
    })
  const restore = (s) => s.replace(/⟨(\d+)⟩/g, (_, i) => placeholderMap[+i] ?? _)

  const joined = strings.map(protect).join(SEP)
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(joined)}`

  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} for lang=${targetLang}`)

  const data = await res.json()
  const raw = data[0].map((x) => x[0]).join('')
  // GT sometimes changes the separator slightly; normalise spaces around it
  const parts = raw.split(/\s*◆◇◆\s*/)
  return parts.map((p) => restore(p.trim()))
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

// ──────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────
async function main() {
  const translated = {}
  let totalDone = 0
  let totalFailed = 0
  let totalStable = 0

  for (const [file, { lang, missing, english }] of Object.entries(todo)) {
    const allItems = [
      ...missing.map((i) => ({ ...i, src: 'missing' })),
      ...english.map((i) => ({ ...i, src: 'english' })),
    ]

    if (allItems.length === 0) continue
    console.log(`\n[${file}] translating ${allItems.length} items → ${lang}`)

    const results = []

    for (let i = 0; i < allItems.length; i += BATCH_SIZE) {
      const batch = allItems.slice(i, i + BATCH_SIZE)
      const enTexts = batch.map((it) => it.en)

      let translations
      try {
        translations = await translateBatch(enTexts, lang)
      } catch (e) {
        console.error(`  Batch [${i}..${i + batch.length - 1}] failed: ${e.message}`)
        // fallback: keep English value, mark as failed
        translations = enTexts
        totalFailed += batch.length
      }

      for (let j = 0; j < batch.length; j++) {
        const t = translations[j] ?? enTexts[j]
        results.push({ key: batch[j].key, en: batch[j].en, translated: t, src: batch[j].src })
        // If translation === original English, record as "stable" (correct loanword/brand name)
        if (t.trim() === batch[j].en.trim()) {
          stable[file] = stable[file] ?? []
          if (!stable[file].includes(batch[j].key)) {
            stable[file].push(batch[j].key)
            totalStable++
          }
        }
        process.stdout.write('.')
      }

      if (i + BATCH_SIZE < allItems.length) await sleep(DELAY_MS)
    }

    translated[file] = { lang, items: results }
    totalDone += results.length
    console.log()
  }

  const outFile = path.resolve('scripts/i18n-translated.json')
  fs.writeFileSync(outFile, JSON.stringify(translated, null, 2), 'utf8')
  fs.writeFileSync(stableFile, JSON.stringify(stable, null, 2), 'utf8')
  console.log(`\n✓ ${totalDone} translated, ${totalFailed} failed, ${totalStable} new stable entries`)
  console.log(`Written to ${outFile}`)
}

main()
