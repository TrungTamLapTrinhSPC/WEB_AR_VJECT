import 'dotenv/config'
import fs from 'fs'
import mysql from 'mysql2/promise'

const ssl = process.env.DB_SSL === 'true' || process.env.DB_SSL === '1'
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

async function runAlter(sql, label) {
  try {
    await conn.query(sql)
    console.log('OK:', label)
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('SKIP (exists):', label)
      return
    }
    throw err
  }
}

const createTables = [
  `CREATE TABLE IF NOT EXISTS feedback_comments (
    id char(36) NOT NULL,
    feedback_id char(36) NOT NULL,
    user_id char(36) NOT NULL,
    body text NOT NULL,
    created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_feedback_comments_feedback (feedback_id),
    CONSTRAINT fk_feedback_comments_feedback FOREIGN KEY (feedback_id) REFERENCES feedbacks (id) ON DELETE CASCADE,
    CONSTRAINT fk_feedback_comments_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`,
  `CREATE TABLE IF NOT EXISTS notifications (
    id char(36) NOT NULL,
    user_id char(36) NOT NULL,
    type varchar(50) NOT NULL,
    title varchar(255) NOT NULL,
    body text DEFAULT NULL,
    link_path varchar(512) DEFAULT NULL,
    read_at datetime DEFAULT NULL,
    created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_notifications_user (user_id, read_at, created_at),
    CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`,
  `CREATE TABLE IF NOT EXISTS user_password_resets (
    id char(36) NOT NULL,
    user_id char(36) NOT NULL,
    token_hash varchar(64) NOT NULL,
    expires_at datetime NOT NULL,
    used_at datetime DEFAULT NULL,
    created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_password_reset_user (user_id),
    KEY idx_password_reset_token (token_hash),
    CONSTRAINT fk_password_reset_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`,
]

for (const sql of createTables) {
  await conn.query(sql)
}
console.log('OK: create tables (feedback_comments, notifications, user_password_resets)')

await runAlter(
  'ALTER TABLE projects ADD COLUMN start_date date DEFAULT NULL AFTER status',
  'projects.start_date',
)
await runAlter(
  'ALTER TABLE projects ADD COLUMN end_date date DEFAULT NULL AFTER start_date',
  'projects.end_date',
)
await runAlter(
  'ALTER TABLE qr_markers ADD COLUMN expires_at datetime DEFAULT NULL AFTER qr_image_url',
  'qr_markers.expires_at',
)

await conn.query(`
  UPDATE qr_markers
  SET expires_at = DATE_ADD(COALESCE(created_at, NOW()), INTERVAL 1 MONTH)
  WHERE expires_at IS NULL AND deleted_at IS NULL
`)
console.log('OK: qr_markers expires_at backfill')

const [tables] = await conn.query(`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = DATABASE()
    AND table_name IN ('feedback_comments', 'notifications', 'user_password_resets')
  ORDER BY table_name
`)
console.log('Tables:', tables.map((r) => r.table_name || r.TABLE_NAME).join(', '))

await conn.end()
console.log('Migration 006 completed on', process.env.DB_NAME)
