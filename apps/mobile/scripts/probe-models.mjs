// Model picker smoke: composer-inline chips + model/effort sheets.
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
await page.screenshot({ path: '/tmp/mobile-composer.png', fullPage: true })

const headerButtons = await page.evaluate(() =>
  Array.from(document.querySelectorAll('.safe-top button')).map(el => el.textContent?.trim()).filter(Boolean),
)
const composer = await page.evaluate(() => ({
  placeholder: document.querySelector('textarea')?.getAttribute('placeholder') ?? null,
  modelChip: document.querySelector('[data-testid="model-chip"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
  effortChip: document.querySelector('[data-testid="effort-chip"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
  headerHasModel: Array.from(document.querySelectorAll('.safe-top button')).some(el => /DeepSeek|Grok|Flash/.test(el.textContent ?? '')),
}))

await page.locator('[data-testid="model-chip"]').click()
await page.waitForTimeout(400)
const modelSheet = await page.evaluate(() => {
  const dialog = document.querySelector('[role="dialog"]')
  const rows = Array.from(dialog?.querySelectorAll('button') ?? [])
    .map(el => el.textContent?.replace(/\s+/g, ' ').trim())
    .filter(t => t && t !== '关闭')
  return {
    open: Boolean(dialog),
    heading: dialog?.querySelector('.font-semibold')?.textContent?.trim() ?? null,
    rowCount: rows.length,
    hasGrok: rows.some(t => t?.includes('Grok 4.6')),
    hasOss: rows.some(t => t?.includes('gpt-oss')),
    hasPickle: rows.some(t => t?.includes('Big Pickle')),
    hasFlash: rows.some(t => t?.includes('DeepSeek V4 Flash')),
  }
})
await page.screenshot({ path: '/tmp/mobile-model-picker.png', fullPage: true })
await page.getByRole('button', { name: '关闭' }).click()
await page.waitForTimeout(250)

await page.locator('[data-testid="effort-chip"]').click()
await page.waitForTimeout(400)
const effortSheet = await page.evaluate(() => {
  const dialog = document.querySelector('[role="dialog"]')
  const rows = Array.from(dialog?.querySelectorAll('button') ?? [])
    .map(el => el.textContent?.replace(/\s+/g, ' ').trim())
    .filter(t => t && t !== '关闭')
  return {
    open: Boolean(dialog),
    heading: dialog?.querySelector('.font-semibold')?.textContent?.trim() ?? null,
    rows,
  }
})
await page.screenshot({ path: '/tmp/mobile-effort-picker.png', fullPage: true })

console.log(JSON.stringify({ headerButtons, composer, modelSheet, effortSheet, jsErrors: errors }, null, 2))
await b.close()
