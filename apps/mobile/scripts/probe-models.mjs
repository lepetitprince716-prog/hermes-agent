// Model picker smoke: open sheet, count curated rows, switch a draft pick.
import { chromium } from 'playwright'
import path from 'path'
import os from 'os'
import fs from 'fs'

const found = fs.readdirSync(path.join(os.homedir(), 'Library/Caches/ms-playwright'))
  .filter(n => n.startsWith('chromium_headless_shell-'))
  .map(n => path.join(os.homedir(), 'Library/Caches/ms-playwright', n, 'chrome-headless-shell-mac-arm64/chrome-headless-shell'))
const exe = found.find(p => fs.existsSync(p))
if (!exe) throw new Error('no playwright chromium_headless_shell')

const b = await chromium.launch({ headless: true, executablePath: exe })
const page = await b.newPage({ viewport: { width: 390, height: 844 } })
const errors = []
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`))
page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`) })

await page.goto('http://127.0.0.1:5175/#/', { waitUntil: 'domcontentloaded', timeout: 15000 })
await page.waitForFunction(() => (document.querySelector('#root')?.childElementCount ?? 0) > 0, { timeout: 8000 })
await page.waitForTimeout(2000)

const headerButtons = await page.evaluate(() =>
  Array.from(document.querySelectorAll('header button, .safe-top button')).map(el => el.textContent?.trim()).filter(Boolean),
)
const chip = page.getByRole('button', { name: /DeepSeek V4 Flash|Grok 4.6|gpt-oss|Big Pickle/ }).first()
const chipVisible = await chip.isVisible().catch(() => false)
if (chipVisible) await chip.click()
else {
  // fallback: last header button is the picker
  const buttons = page.locator('.safe-top button')
  await buttons.nth(await buttons.count() - 1).click()
}
await page.waitForTimeout(800)
await page.screenshot({ path: '/tmp/mobile-model-picker.png', fullPage: true })

const sheet = await page.evaluate(() => {
  const dialog = document.querySelector('[role="dialog"]')
  const titles = Array.from(dialog?.querySelectorAll('.uppercase') ?? []).map(el => el.textContent?.trim())
  const rows = Array.from(dialog?.querySelectorAll('button') ?? [])
    .map(el => el.textContent?.replace(/\s+/g, ' ').trim())
    .filter(t => t && t !== '关闭')
  return {
    open: Boolean(dialog),
    titles,
    rowCount: rows.length,
    firstRows: rows.slice(0, 4),
    hasGrok: rows.some(t => t?.includes('Grok 4.6')),
    hasOss: rows.some(t => t?.includes('gpt-oss')),
    hasPickle: rows.some(t => t?.includes('Big Pickle')),
    hasFlash: rows.some(t => t?.includes('DeepSeek V4 Flash')),
  }
})
await page.screenshot({ path: '/tmp/mobile-model-picked.png', fullPage: true })
await page.keyboard.press('Escape').catch(() => {})
console.log(JSON.stringify({ headerButtons, chipVisible, sheet, jsErrors: errors }, null, 2))
await b.close()
