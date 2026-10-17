import { v4 as uuidv4 } from 'uuid'
import { getRedis } from '../redis/client.js'

const JOB_TTL_SECONDS = 24 * 60 * 60
const memoryJobs = new Map()

function jobKey(id) {
  return `upload-job:${id}`
}

async function saveJob(job) {
  memoryJobs.set(job.id, job)
  try {
    await getRedis().setex(jobKey(job.id), JOB_TTL_SECONDS, JSON.stringify(job))
  } catch {
    /* Redis down — memory copy still serves polls on this instance */
  }
}

export async function createUploadJob({ userId, name }) {
  const now = new Date().toISOString()
  const job = {
    id: uuidv4(),
    user_id: userId,
    name,
    status: 'queued',
    stage: 'queued',
    progress: 0,
    model: null,
    error: null,
    created_at: now,
    updated_at: now,
  }
  await saveJob(job)
  return job
}

export async function getUploadJob(id) {
  try {
    const raw = await getRedis().get(jobKey(id))
    if (raw) return JSON.parse(raw)
  } catch {
    /* fall through to memory */
  }
  return memoryJobs.get(id) ?? null
}

/** Merge fields into the job. Progress never moves backwards. */
export async function updateUploadJob(id, patch) {
  const job = memoryJobs.get(id) ?? (await getUploadJob(id))
  if (!job) return null
  const next = { ...job, ...patch, updated_at: new Date().toISOString() }
  if (patch.progress != null) next.progress = Math.max(job.progress ?? 0, Math.min(100, patch.progress))
  await saveJob(next)
  if (next.status === 'done' || next.status === 'failed') {
    setTimeout(() => memoryJobs.delete(id), JOB_TTL_SECONDS * 1000).unref()
  }
  return next
}

/**
 * Throttled progress reporter: writes only when the integer percent or stage changes.
 * @param {string} id
 * @param {number} from overall % where this step starts
 * @param {number} to overall % where this step ends
 */
export function progressReporter(id, from, to) {
  let last = { stage: null, progress: -1 }
  return ({ stage, percent }) => {
    const progress = Math.floor(from + ((to - from) * Math.min(100, Math.max(0, percent))) / 100)
    if (stage === last.stage && progress === last.progress) return
    last = { stage, progress }
    updateUploadJob(id, { status: 'processing', stage, progress }).catch(() => {})
  }
}

const maxConcurrent = Math.max(1, Number(process.env.IFC_CONVERT_CONCURRENCY) || 1)
let running = 0
const waiting = []

/** Runs fn when a conversion slot is free (each convert can use ~2GB RAM). */
export function runInConvertQueue(fn) {
  return new Promise((resolve, reject) => {
    const start = () => {
      running += 1
      Promise.resolve()
        .then(fn)
        .then(resolve, reject)
        .finally(() => {
          running -= 1
          waiting.shift()?.()
        })
    }
    if (running < maxConcurrent) start()
    else waiting.push(start)
  })
}
