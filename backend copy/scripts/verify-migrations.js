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

const [tables] = await conn.query(`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = DATABASE()
    AND table_name IN (
      'feedback_comments', 'notifications', 'user_password_resets',
      'project_attribute_groups', 'project_attribute_group_links', 'bim_element_styles'
    )
  ORDER BY table_name
`)

const [cols] = await conn.query(`
  SELECT table_name, column_name FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND (
      (table_name = 'projects' AND column_name IN ('start_date', 'end_date'))
      OR (table_name = 'qr_markers' AND column_name = 'expires_at')
    )
`)

console.log('DB:', process.env.DB_NAME)
console.log('Tables (006+007):', tables.map((r) => r.TABLE_NAME || r.table_name).join(', ') || '(none)')
console.log('Columns (006):', cols.map((r) => `${r.TABLE_NAME || r.table_name}.${r.COLUMN_NAME || r.column_name}`).join(', ') || '(none)')

await conn.end()
