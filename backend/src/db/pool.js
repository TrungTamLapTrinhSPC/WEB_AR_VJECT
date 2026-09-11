import mysql from 'mysql2/promise'
import { config } from '../config/index.js'

export const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  ssl: config.db.ssl,
  waitForConnections: true,
  connectionLimit: 10,
  timezone: '+00:00',
})

export async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params)
  return rows
}

export async function queryOne(sql, params = []) {
  const rows = await query(sql, params)
  return rows[0] ?? null
}
