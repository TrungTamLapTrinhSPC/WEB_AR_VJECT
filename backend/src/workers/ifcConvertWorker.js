import { parentPort, workerData } from 'worker_threads'
import { convertIfcToOutputs } from '../utils/ifcConvert.js'

const { ifcPath, workDir, baseName, options } = workerData

try {
  const outputs = await convertIfcToOutputs(ifcPath, workDir, baseName, {
    ...options,
    onProgress: (p) => parentPort.postMessage({ type: 'progress', ...p }),
  })
  parentPort.postMessage({ type: 'done', outputs })
} catch (err) {
  parentPort.postMessage({ type: 'error', message: err?.message || String(err) })
}
