// Stats 页端到端验证
import { chromium } from 'playwright'
import path from 'path'
import os from 'os'

const exe = path.join(os.homedir(), 'Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell')

const b = await chromium.launch({ headless: true, executablePath: exe })
const page = await b.newPage({ viewport: { width: 390, height: 844 } })
const errors = []
page.on('pageerror', e => errors.push(e.message))
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })

await page.goto('http://127.0.0.1:5175/#/stats', { waitUntil: 'networkidle', timeout: 15000 })
await page.waitForTimeout(3500)

const state = await page.evaluate(() => {
  const errEl = document.querySelector('.text-red-500')
  const metrics = Array.from(document.querySelectorAll('.font-mono.text-2xl')).map(el => el.textContent)
  const labels = Array.from(document.querySelectorAll('.uppercase.tracking-wider')).map(el => el.textContent)
  const bars = document.querySelectorAll('.h-full.rounded-full').length
  const sparkBars = document.querySelectorAll('.flex-1.rounded-sm').length
  return {
    error: errEl?.textContent ?? null,
    metrics,
    labels: labels.slice(0, 8),
    toolBars: bars,
    sparkBars,
  }
})
console.log(JSON.stringify(state, null, 2))
console.log('js errors:', errors.length ? errors : 'none')
await page.screenshot({ path: '/tmp/mobile-stats.png', fullPage: true })
await b.close()
