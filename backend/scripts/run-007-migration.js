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

const sql = fs.readFileSync(
  new URL('../migrations/007_attribute_groups_element_styles.sql', import.meta.url),
  'utf8',
)

for (const stmt of sql.split(';').map((s) => s.trim()).filter(Boolean)) {
  await conn.query(stmt)
  console.log('OK:', stmt.slice(0, 60).replace(/\s+/g, ' ') + '…')
}

await conn.end()
console.log('Migration 007 completed on', process.env.DB_NAME)
