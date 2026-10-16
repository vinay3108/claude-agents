#!/usr/bin/env node
/**
 * Export Striver's A2Z sheet from takeUforward to a local JSON file.
 *
 *   node scripts/tuf/export-a2z.mjs                 # public page: all problems, status = "unsolved"
 *   node scripts/tuf/export-a2z.mjs --html page.html # parse a page you saved while logged in (real status)
 *
 * Output: data/tuf/a2z.json (git-ignored). One request; nothing is sent anywhere else.
 * The sheet is takeUforward's content: keep the file private, do not commit or share it.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseA2zSheet } from './parseA2zSheet.mjs'

const SHEET_URL = 'https://takeuforward.org/prep-hub/strivers-a2z-dsa-sheet'
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../../data/tuf/a2z.json')
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36'

async function loadHtml() {
  const i = process.argv.indexOf('--html')
  if (i !== -1) {
    const file = process.argv[i + 1]
    if (!file) throw new Error('--html needs a file path')
    return { html: await readFile(file, 'utf8'), source: `file:${file}` }
  }
  const res = await fetch(SHEET_URL, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30_000) })
  if (!res.ok) throw new Error(`takeUforward responded ${res.status}`)
  return { html: await res.text(), source: SHEET_URL }
}

const { html, source } = await loadHtml()
const sheet = parseA2zSheet(html)
await mkdir(dirname(OUT), { recursive: true })
await writeFile(OUT, JSON.stringify({ exportedAt: new Date().toISOString(), source, ...sheet }, null, 2))

const s = sheet.summary
console.log(`A2Z: ${s.problems} problems in ${s.sections} sections | solved ${s.solved} | LeetCode links ${s.withLeetCode}`)
console.log(`Saved ${OUT}`)
