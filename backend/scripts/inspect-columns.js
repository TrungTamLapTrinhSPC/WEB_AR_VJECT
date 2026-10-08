import 'dotenv/config'
import fs from 'fs'
import mysql from 'mysql2/promise'

const ssl =
  process.env.DB_SSL === 'true' || process.env.DB_SSL === '1'
    ? { ca: fs.readFileSync(new URL('../certs/global-bundle.pem', import.meta.url)) }
    : undefined

const conn = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USERNAME || process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl,
  connectTimeout: 60_000,
})

const [rows] = await conn.query(`
  SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, CHARACTER_SET_NAME, COLLATION_NAME
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME IN ('feedbacks', 'users', 'projects', 'qr_markers')
    AND COLUMN_NAME IN ('id', 'status', 'qr_image_url', 'start_date', 'expires_at')
  ORDER BY TABLE_NAME, COLUMN_NAME
`)
console.table(rows)
await conn.end()
