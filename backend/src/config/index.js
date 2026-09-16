import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const backendRoot = path.resolve(__dirname, '../..')

function resolveSslCa(relativePath) {
  const resolved = path.isAbsolute(relativePath)
    ? relativePath
    : path.resolve(backendRoot, relativePath)
  if (!fs.existsSync(resolved)) {
    throw new Error(`DB_SSL_CA file not found: ${resolved}`)
  }
  return fs.readFileSync(resolved)
}

const dbSslEnabled = process.env.DB_SSL === 'true' || process.env.DB_SSL === '1'

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USERNAME || process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'vjectar',
    ssl: dbSslEnabled
      ? { ca: resolveSslCa(process.env.DB_SSL_CA || 'certs/global-bundle.pem') }
      : undefined,
  },

  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'pa3:',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },

  cache: {
    list: parseInt(process.env.CACHE_TTL_LIST || '60', 10),
    detail: parseInt(process.env.CACHE_TTL_DETAIL || '300', 10),
    dashboard: parseInt(process.env.CACHE_TTL_DASHBOARD || '120', 10),
    settings: parseInt(process.env.CACHE_TTL_SETTINGS || '600', 10),
  },

  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'PA3 Admin <noreply@localhost>',
  },

  aws: {
    region: process.env.AWS_REGION || 'ap-southeast-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    s3Bucket: process.env.AWS_S3_BUCKET || '',
  },


  emailVerification: {
    codeTtlMinutes: parseInt(process.env.EMAIL_CODE_TTL_MINUTES || '30', 10),
    requireGmail: process.env.REQUIRE_GMAIL === 'true',
  },

  password: {
    minLength: parseInt(process.env.PASSWORD_MIN_LENGTH || '8', 10),
    requireUpper: process.env.PASSWORD_REQUIRE_UPPER !== 'false',
    requireLower: process.env.PASSWORD_REQUIRE_LOWER !== 'false',
    requireDigit: process.env.PASSWORD_REQUIRE_DIGIT !== 'false',
    requireSpecial: process.env.PASSWORD_REQUIRE_SPECIAL !== 'false',
  },

}
