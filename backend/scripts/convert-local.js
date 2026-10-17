/**
 * Convert IFC locally in the worker thread (same path as upload) and report progress/timing.
 * No DB / S3. Usage: node scripts/convert-local.js <file.ifc> [discipline]
 */
import os from 'os'
import path from 'path'
import fs from 'fs/promises'
import { convertIfcInWorker } from '../src/utils/convertInWorker.js'

const ifcPath = process.argv[2]
if (!ifcPath) {
  console.error('Usage: node scripts/convert-local.js <file.ifc> [discipline]')
  process.exit(1)
}
const discipline = process.argv[3] || 'architecture'
const workDir = path.join(os.tmpdir(), `pa3-convert-${Date.now()}`)

const t0 = Date.now()
let last = ''
const out = await convertIfcInWorker({
  ifcPath: path.resolve(ifcPath),
  workDir,
  options: { discipline },
  onProgress: ({ stage, percent }) => {
    if (stage === last && percent % 10 !== 0) return
    last = stage
    console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${stage} ${percent}%`)
  },
})
const seconds = ((Date.now() - t0) / 1000).toFixed(1)

for (const p of [out.glbPath, out.usdzPath, out.metadataPath, out.psetsPath].filter(Boolean)) {
  const st = await fs.stat(p)
  console.log(`${path.basename(p).padEnd(28)} ${(st.size / 1024 / 1024).toFixed(1)} MB`)
}
console.log(`Convert time: ${seconds}s`)
console.log(`Output dir: ${workDir}`)
