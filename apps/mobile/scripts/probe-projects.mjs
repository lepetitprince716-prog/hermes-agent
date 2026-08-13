// 项目页端到端验证（headless）
import { chromium } from 'playwright'
import path from 'path'
import os from 'os'

const exe = path.join(os.homedir(), 'Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell')

const b = await chromium.launch({ headless: true, executablePath: exe })
const page = await b.newPage({ viewport: { width: 390, height: 844 } })
const errors = []
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`))
page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`) })

await page.goto('http://127.0.0.1:5175/#/projects', { waitUntil: 'networkidle', timeout: 15000 })
await page.waitForTimeout(3000)

const state = await page.evaluate(() => {
  const errEl = document.querySelector('.text-red-500')
  const rows = Array.from(document.querySelectorAll('li'))
  return {
    badge: Array.from(document.querySelectorAll('span')).find(s => ['已连接','未连接','连接中','错误'].includes(s.textContent ?? ''))?.textContent,
    error: errEl?.textContent ?? null,
    projectRows: rows.length,
    firstRows: rows.slice(0, 5).map(r => r.textContent?.slice(0, 80)),
  }
})
console.log(JSON.stringify(state, null, 2))
console.log('js errors:', errors.length ? errors : 'none')
await page.screenshot({ path: '/tmp/mobile-projects-v2.png', fullPage: true })
await b.close()
