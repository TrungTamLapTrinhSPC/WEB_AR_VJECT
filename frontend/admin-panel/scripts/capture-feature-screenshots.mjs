/**
 * Chụp màn hình các tính năng web admin (cần `npm run dev` đang chạy).
 * Usage: node scripts/capture-feature-screenshots.mjs
 */
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.resolve(__dirname, '../../../docs/feature-screenshots')
const BASE = process.env.SCREENSHOT_BASE || 'http://localhost:5173/ar'
const EMAIL = process.env.SCREENSHOT_EMAIL || 'admin@pa3.com'
const PASSWORD = process.env.SCREENSHOT_PASSWORD || '123456'

fs.mkdirSync(OUT_DIR, { recursive: true })

async function shot(page, name) {
  const file = path.join(OUT_DIR, `${name}.png`)
  await page.waitForTimeout(400)
  await page.screenshot({ path: file, fullPage: true })
  console.log('OK', file)
}

async function waitTitle(page, text, timeout = 15000) {
  await page.waitForFunction(
    (t) => document.querySelector('.page-title')?.textContent?.trim() === t,
    text,
    { timeout },
  )
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('h1', { timeout: 15000 })
  await shot(page, '01-login')
  await page.getByPlaceholder('admin@pa3.com').fill(EMAIL)
  await page.locator('form input[type="password"]').fill(PASSWORD)
  await page.getByRole('button', { name: /đăng nhập|sign in|ログイン/i }).click()
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30000 })
  await page.waitForSelector('.page-title', { timeout: 30000 })
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'vi-VN',
  })
  const page = await context.newPage()

  try {
    await page.goto(`${BASE}/forgot-password`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('h1', { timeout: 10000 })
    await shot(page, '02-forgot-password')

    await login(page)
    await shot(page, '03-dashboard')

    await page.goto(`${BASE}/projects`, { waitUntil: 'networkidle' })
    await waitTitle(page, 'Quản lý dự án')
    await shot(page, '04-projects-filters')

    await page.goto(`${BASE}/attribute-groups`, { waitUntil: 'networkidle' })
    await waitTitle(page, 'Nhóm thuộc tính dự án')
    await shot(page, '05-attribute-groups')

    await page.goto(`${BASE}/feedback`, { waitUntil: 'networkidle' })
    await waitTitle(page, 'Quản lý phản hồi')
    await shot(page, '06-feedback-tabs')

    const fbRow = page.locator('.fb-list-main').first()
    if (await fbRow.count()) {
      await fbRow.click()
      await page.waitForSelector('#feedback.active, [id="feedback"]', { timeout: 5000 }).catch(() => {})
      await page.waitForSelector('.fb-comment-thread, .modal-overlay', { timeout: 8000 }).catch(() => {})
      await shot(page, '07-feedback-detail-comments')
      await page.keyboard.press('Escape')
    }

    await page.goto(`${BASE}/qr`, { waitUntil: 'networkidle' })
    await waitTitle(page, 'Quản lý QR Markers')
    await shot(page, '08-qr-list')
    const qrNew = page.getByRole('button', { name: /Thêm QR marker|Add QR marker/i }).first()
    if (await qrNew.isVisible().catch(() => false)) {
      await qrNew.click()
      await page.waitForSelector('#qr-new.active, [id="qr-new"]', { timeout: 8000 }).catch(() => {})
      await page.waitForTimeout(600)
      await shot(page, '09-qr-new-valid-days')
      await page.keyboard.press('Escape')
    }

    await page.goto(`${BASE}/elements`, { waitUntil: 'networkidle' })
    await waitTitle(page, 'Cấu kiện M&E')
    await shot(page, '10-elements-colors')

    await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' })
    await waitTitle(page, 'Cài đặt hệ thống')
    await page.locator('.tabs .tab', { hasText: /^Sao lưu$|^Backup$/ }).click()
    await page.waitForTimeout(800)
    await shot(page, '11-settings-backup')

    await page.getByLabel(/^Thông báo$|^Notifications$|^通知$/).click()
    await page.waitForTimeout(500)
    await shot(page, '12-notifications-panel')

    await page.locator('[role="button"]').filter({ has: page.locator('.avatar') }).click()
    await page.waitForSelector('#profile.active, [id="profile"]', { timeout: 8000 }).catch(() => {})
    await page.waitForTimeout(400)
    await shot(page, '13-profile-change-password')
    await page.keyboard.press('Escape')

    await page.goto(`${BASE}/users`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1200)
    await shot(page, '14-users-admin-password')

    await page.getByRole('button', { name: /ja/i }).click()
    await page.waitForTimeout(500)
    await page.goto(`${BASE}/feedback`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)
    await shot(page, '15-feedback-japanese-ui')
  } finally {
    await browser.close()
  }

  console.log('\nDone. Output:', OUT_DIR)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
