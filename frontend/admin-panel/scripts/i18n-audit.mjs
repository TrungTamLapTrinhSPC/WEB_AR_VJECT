/**
 * i18n audit: missing keys per language, t() keys not in dictionary, hard-coded UI text.
 * Usage: node scripts/i18n-audit.mjs [--json]
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src')
const { I18N } = await import(pathToFileURL(path.join(root, 'data', 'i18n.js')).href)
const LANGS = Object.keys(I18N)

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) return walk(p)
    return /\.(jsx?|mjs)$/.test(e.name) ? [p] : []
  })
}

const DICTIONARIES = [path.join('data', 'i18n.js'), path.join('data', 'errorI18n.js')]
const files = walk(root).filter((f) => !DICTIONARIES.some((d) => f.endsWith(d)))
const allKeys = new Set(LANGS.flatMap((l) => Object.keys(I18N[l])))

const missingByLang = Object.fromEntries(LANGS.map((l) => [l, [...allKeys].filter((k) => !(k in I18N[l]))]))

const usedKeys = new Map()
const T_CALL = /\bt\(\s*['"]([a-zA-Z0-9_]+)['"]\s*\)/g
const VI_CHARS = /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i
const hardcoded = []

for (const file of files) {
  const rel = path.relative(root, file).replaceAll('\\', '/')
  const lines = fs.readFileSync(file, 'utf8').split('\n')
  lines.forEach((line, i) => {
    for (const m of line.matchAll(T_CALL)) {
      if (!usedKeys.has(m[1])) usedKeys.set(m[1], `${rel}:${i + 1}`)
    }
    const trimmed = line.trim()
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return
    const code = line.replace(/\/\/.*$/, '')
    if (VI_CHARS.test(code)) hardcoded.push({ where: `${rel}:${i + 1}`, text: trimmed.slice(0, 140) })
  })
}

const undefinedKeys = [...usedKeys].filter(([k]) => !allKeys.has(k))

const { ERROR_MESSAGES } = await import(pathToFileURL(path.join(root, 'data', 'errorI18n.js')).href)
const errorGaps = Object.entries(ERROR_MESSAGES)
  .filter(([, m]) => LANGS.some((l) => !m[l]))
  .map(([k]) => k)

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ missingByLang, undefinedKeys, hardcoded, errorGaps }, null, 2))
} else {
  for (const l of LANGS) console.log(`Keys missing in "${l}": ${missingByLang[l].length}`)
  console.log(`t() keys used but not defined in any language: ${undefinedKeys.length}`)
  undefinedKeys.forEach(([k, where]) => console.log(`  ${k}  (${where})`))
  console.log(`Lines with hard-coded Vietnamese text: ${hardcoded.length}`)
  hardcoded.forEach((h) => console.log(`  ${h.where}  ${h.text}`))
  console.log(`Error messages missing a language: ${errorGaps.length}`)
  errorGaps.forEach((k) => console.log(`  ${k}`))
}
