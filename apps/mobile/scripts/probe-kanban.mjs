// Kanban 页端到端验证（headless probe）
import { chromium } from 'playwright'
import path from 'path'
import os from 'os'

const exe = path.join(os.homedir(), 'Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell')

const b = await chromium.launch({ headless: true, executablePath: exe })
const page = await b.newPage({ viewport: { width: 390, height: 844 } })
const errors = []
page.on('pageerror', e => errors.push(e.message))
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })

await page.goto('http://127.0.0.1:5175/#/kanban', { waitUntil: 'networkidle', timeout: 15000 })
await page.waitForTimeout(3000)

const state = await page.evaluate(() => {
  const errEl = document.querySelector('.text-red-500')
  const chips = Array.from(document.querySelectorAll('button')).filter(b2 => /分诊|待办|就绪|完成|运行中/.test(b2.textContent ?? ''))
  const cards = Array.from(document.querySelectorAll('button')).filter(b2 => b2.textContent?.includes('t_'))
  return {
    badge: Array.from(document.querySelectorAll('span')).find(s => ['已连接','未连接','连接中','错误'].includes(s.textContent ?? ''))?.textContent,
    error: errEl?.textContent ?? null,
    chipLabels: chips.map(c => c.textContent?.trim()).slice(0, 10),
    cardCount: cards.length,
    firstCard: cards[0]?.textContent?.slice(0, 60) ?? null,
  }
})
console.log(JSON.stringify(state, null, 2))
console.log('js errors:', errors.length ? errors : 'none')
await page.screenshot({ path: '/tmp/mobile-kanban.png', fullPage: true })
await b.close()
