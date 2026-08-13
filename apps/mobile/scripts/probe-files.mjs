// 文件页端到端验证：项目列表 → 点进项目 → 目录浏览
import { chromium } from 'playwright'
import path from 'path'
import os from 'os'

const exe = path.join(os.homedir(), 'Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell')

const b = await chromium.launch({ headless: true, executablePath: exe })
const page = await b.newPage({ viewport: { width: 390, height: 844 } })
const errors = []
page.on('pageerror', e => errors.push(e.message))

await page.goto('http://127.0.0.1:5175/#/projects', { waitUntil: 'networkidle', timeout: 15000 })
await page.waitForTimeout(2500)

// 点第一个项目（Hermes talk）
const firstRow = page.locator('li').first()
await firstRow.locator('button').first().click()
await page.waitForTimeout(2500)

const filesState = await page.evaluate(() => {
  const errEl = document.querySelector('.text-red-500')
  const pathEl = document.querySelector('.truncate.text-xs')
  const rows = Array.from(document.querySelectorAll('li'))
  return {
    path: pathEl?.textContent,
    error: errEl?.textContent ?? null,
    entryCount: rows.length,
    firstEntries: rows.slice(0, 8).map(r => r.textContent?.slice(0, 50)),
  }
})
console.log('files page:', JSON.stringify(filesState, null, 2))

// 点一个文件试预览（找非目录行）
const fileRow = page.locator('li', { hasText: '.md' }).first()
if (await fileRow.count()) {
  await fileRow.locator('button').first().click()
  await page.waitForTimeout(2000)
  const preview = await page.evaluate(() => {
    const sheet = document.querySelector('[role="dialog"]')
    return sheet ? { opened: true, text: sheet.textContent?.slice(0, 200) } : { opened: false }
  })
  console.log('preview sheet:', JSON.stringify(preview, null, 2))
}

console.log('js errors:', errors.length ? errors : 'none')
await page.screenshot({ path: '/tmp/mobile-files.png', fullPage: true })
await b.close()
