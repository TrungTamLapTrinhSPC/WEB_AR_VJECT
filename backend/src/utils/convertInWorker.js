import { Worker } from 'worker_threads'

const workerUrl = new URL('../workers/ifcConvertWorker.js', import.meta.url)

/**
 * Runs convertIfcToOutputs in a worker thread: web-ifc parsing is synchronous and would
 * otherwise block the event loop (no API responses, no progress polling) for the whole convert.
 * @param {{ ifcPath: string, workDir: string, baseName?: string, options?: object,
 *   onProgress?: (p: { stage: string, percent: number }) => void }} args
 */
export function convertIfcInWorker({ ifcPath, workDir, baseName = 'model', options = {}, onProgress }) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(workerUrl, {
      workerData: { ifcPath, workDir, baseName, options },
    })
    let settled = false
    const finish = (fn, value) => {
      if (settled) return
      settled = true
      fn(value)
    }

    worker.on('message', (msg) => {
      if (msg.type === 'progress') onProgress?.({ stage: msg.stage, percent: msg.percent })
      else if (msg.type === 'done') finish(resolve, msg.outputs)
      else if (msg.type === 'error') finish(reject, new Error(msg.message))
    })
    worker.on('error', (err) => finish(reject, err))
    worker.on('exit', (code) => {
      if (code !== 0) finish(reject, new Error(`IFC convert worker exited with code ${code}`))
    })
  })
}
