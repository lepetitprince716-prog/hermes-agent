// Model picker smoke: merged chip + glass sheet over the blue page.
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
  Array.from(document.querySelectorAll('.safe-top button')).map(el => el.textContent?.trim() || el.getAttribute('aria-label')).filter(Boolean),
)
const composer = await page.evaluate(() => ({
  placeholder: document.querySelector('textarea')?.getAttribute('placeholder') ?? null,
  modelChip: document.querySelector('[data-testid="model-chip"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
  effortChip: document.querySelector('[data-testid="effort-chip"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
  headerHasModel: Array.from(document.querySelectorAll('.safe-top button')).some(el => /DeepSeek|Grok|Flash/.test(el.textContent ?? '')),
  attach: Boolean(document.querySelector('button[aria-label="附件"]')),
  tabs: Array.from(document.querySelectorAll('nav a span')).map(el => el.textContent?.trim()).filter(Boolean),
}))

await page.locator('[data-testid="model-chip"]').click()
await page.waitForTimeout(400)
const modelSheet = await page.evaluate(() => {
  const dialog = document.querySelector('[role="dialog"]')
  const rows = Array.from(dialog?.querySelectorAll('button') ?? [])
    .map(el => el.textContent?.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  return {
    open: Boolean(dialog),
    heading: dialog?.querySelector('.font-semibold')?.textContent?.trim() ?? null,
    headingOk: (dialog?.querySelector('.font-semibold')?.textContent ?? '').includes('推理'),
    rowCount: rows.length,
    hasGrok: rows.some(t => t?.includes('Grok 4.6')),
    hasOss: rows.some(t => t?.includes('gpt-oss')),
    hasPickle: rows.some(t => t?.includes('Big Pickle')),
    hasFlash: rows.some(t => t?.includes('DeepSeek V4 Flash')),
    hasEffort: rows.some(t => t?.includes('专家')),
    glass: (() => {
      const panel = dialog?.querySelector('.backdrop-blur-2xl, [class*="backdrop-blur"]')
      if (!panel) return null
      const s = getComputedStyle(panel)
      return { bg: s.backgroundColor, blur: s.backdropFilter || s.webkitBackdropFilter }
    })(),
  }
})
await page.screenshot({ path: '/tmp/mobile-model-picker.png', fullPage: true })
await page.keyboard.press('Escape')
await page.waitForTimeout(250)

const desktop = await b.newPage({ viewport: { width: 1280, height: 820 } })
await desktop.goto('http://127.0.0.1:5175/#/', { waitUntil: 'domcontentloaded', timeout: 15000 })
await desktop.waitForFunction(() => (document.querySelector('#root')?.childElementCount ?? 0) > 0, { timeout: 8000 })
await desktop.waitForTimeout(1500)
const desktopLayout = await desktop.evaluate(() => {
  const ta = document.querySelector('textarea')
  const box = ta?.parentElement
  const chipsInCapsule = Boolean(box?.querySelector('[data-testid="model-chip"]'))
  const word = document.querySelector('.wordmark')
  const mark = document.querySelector('img[src*="nous-girl"]')
  return {
    placeholder: ta?.getAttribute('placeholder') ?? null,
    capsuleH: box ? Math.round(box.getBoundingClientRect().height) : null,
    capsuleRadius: box ? getComputedStyle(box).borderRadius : null,
    chipsInCapsule,
    sendAria: document.querySelector('button[aria-label="发送"]')?.getAttribute('aria-label') ?? null,
    wordmark: word?.textContent?.trim() ?? null,
    wordFont: word ? getComputedStyle(word).fontFamily : null,
    markSrc: mark?.getAttribute('src') ?? null,
  }
})
await desktop.locator('[data-testid="model-chip"]').click()
await desktop.waitForTimeout(300)
const desktopGlass = await desktop.evaluate(() => {
  const menu = document.querySelector('[role="menu"]')
  if (!menu) return null
  const s = getComputedStyle(menu)
  return { bg: s.backgroundColor, blur: s.backdropFilter || s.webkitBackdropFilter }
})
await desktop.screenshot({ path: '/tmp/chat-refs/ours-desktop.png', fullPage: false })
await desktop.close()

if (!modelSheet.glass?.blur || modelSheet.glass.blur === 'none') {
  throw new Error(`phone sheet is not glass: ${JSON.stringify(modelSheet.glass)}`)
}
if (!desktopGlass?.blur || desktopGlass.blur === 'none') {
  throw new Error(`desktop popover is not glass: ${JSON.stringify(desktopGlass)}`)
}
if (desktopLayout.markSrc) {
  throw new Error(`nous-girl mark still in empty state: ${desktopLayout.markSrc}`)
}
if (composer.placeholder !== '输入消息' && composer.placeholder !== '未连接到网关') {
  throw new Error(`unexpected placeholder: ${composer.placeholder}`)
}
if (!desktopLayout.wordmark || !/Hermes Agent/i.test(desktopLayout.wordmark)) {
  throw new Error(`wordmark missing: ${desktopLayout.wordmark}`)
}

console.log(JSON.stringify({ headerButtons, composer, modelSheet, desktopLayout, desktopGlass, jsErrors: errors }, null, 2))
await b.close()
