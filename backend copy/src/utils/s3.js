import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { config } from '../config/index.js'

let client

function s3Enabled() {
  return Boolean(
    config.aws.s3Bucket && config.aws.accessKeyId && config.aws.secretAccessKey,
  )
}

function getClient() {
  if (!client) {
    client = new S3Client({
      region: config.aws.region,
      credentials: {
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey,
      },
    })
  }
  return client
}

export function isS3Configured() {
  return s3Enabled()
}

export function s3PublicUrl(key) {
  return `https://${config.aws.s3Bucket}.s3.${config.aws.region}.amazonaws.com/${key}`
}

/** S3 object key from stored public URL or raw key. */
export function keyFromPublicUrl(input) {
  if (input == null || input === '') return null
  const s = String(input).trim()
  if (!s.includes('://')) return s.replace(/^\//, '')

  try {
    const u = new URL(s)
    let pathKey = decodeURIComponent(u.pathname.replace(/^\//, ''))
    const bucket = config.aws.s3Bucket
    if (bucket && pathKey.startsWith(`${bucket}/`)) {
      pathKey = pathKey.slice(bucket.length + 1)
    }
    return pathKey || null
  } catch {
    return null
  }
}

export async function createPresignedDownload(key, expiresIn = 3600) {
  if (!s3Enabled()) throw new Error('S3 is not configured')
  const command = new GetObjectCommand({
    Bucket: config.aws.s3Bucket,
    Key: key,
  })
  return getSignedUrl(getClient(), command, { expiresIn })
}

export function modelsProjectPrefix(projectId) {
  return `models/${projectId}`
}

export function modelsObjectPrefix(projectId, modelId) {
  return `models/${projectId}/${modelId}`
}

function toBuffer(body) {
  if (Buffer.isBuffer(body)) return body
  if (body instanceof Uint8Array) return Buffer.from(body)
  if (typeof body === 'string') return Buffer.from(body, 'utf8')
  return Buffer.from(String(body))
}

/** PutObject (small) or multipart Upload (large) — always sends Buffer + ContentLength. */
export async function uploadObject(key, body, contentType) {
  if (!s3Enabled()) {
    throw new Error('S3 is not configured')
  }
  const buf = toBuffer(body)
  const params = {
    Bucket: config.aws.s3Bucket,
    Key: key,
    Body: buf,
    ContentType: contentType,
    ContentLength: buf.length,
  }

  if (buf.length > 5 * 1024 * 1024) {
    const upload = new Upload({
      client: getClient(),
      params,
      queueSize: 4,
      partSize: 8 * 1024 * 1024,
      leavePartsOnError: false,
    })
    await upload.done()
  } else {
    await getClient().send(new PutObjectCommand(params))
  }

  return { key, publicUrl: s3PublicUrl(key) }
}

/** S3 has no real folders — placeholder object marks project namespace. */
export async function ensureModelsProjectFolder(projectId) {
  if (!s3Enabled()) return null
  const key = `${modelsProjectPrefix(projectId)}/.keep`
  await uploadObject(key, Buffer.alloc(0), 'application/octet-stream')
  return key
}

export async function createPresignedUpload(key, contentType, expiresIn = 900) {
  if (!s3Enabled()) {
    throw new Error('S3 is not configured')
  }
  const command = new PutObjectCommand({
    Bucket: config.aws.s3Bucket,
    Key: key,
    ContentType: contentType,
  })
  const uploadUrl = await getSignedUrl(getClient(), command, { expiresIn })
  return { uploadUrl, key, publicUrl: s3PublicUrl(key), bucket: config.aws.s3Bucket, region: config.aws.region }
}
