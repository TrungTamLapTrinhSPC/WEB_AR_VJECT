import { Router } from 'express'
import fs from 'fs/promises'
import path from 'path'
import { asyncHandler } from '../middleware/errorHandler.js'
import { requireRole } from '../middleware/auth.js'

const router = Router()
const backupDir = process.env.BACKUP_DIR || path.join(process.cwd(), 'backups')

router.get('/info', requireRole('admin'), asyncHandler(async (_req, res) => {
  let files = []
  try {
    const names = await fs.readdir(backupDir)
    files = await Promise.all(names.map(async (name) => {
      const stat = await fs.stat(path.join(backupDir, name))
      return { name, size: stat.size, mtime: stat.mtime.toISOString() }
    }))
    files.sort((a, b) => b.mtime.localeCompare(a.mtime))
  } catch {
    files = []
  }

  res.json({
    backup_dir: backupDir,
    files: files.slice(0, 20),
    cron_hint: '0 2 * * * mysqldump -h $DB_HOST -u $DB_USER -p$DB_PASS $DB_NAME | gzip > backups/vjectar-$(date +\\%F).sql.gz',
    note: 'Đặt BACKUP_DIR và cron mysqldump trên server. API chỉ liệt kê file backup có sẵn.',
  })
}))

export default router
