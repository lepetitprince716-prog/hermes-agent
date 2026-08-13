// Kanban 交互验证：新建任务 + 打开详情 sheet
import { chromium } from 'playwright'
import path from 'path'
import os from 'os'

const exe = path.join(os.homedir(), 'Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell')

const b = await chromium.launch({ headless: true, executablePath: exe })
const page = await b.newPage({ viewport: { width: 390, height: 844 } })
const errors = []
page.on('pageerror', e => errors.push(e.message))

await page.goto('http://127.0.0.1:5175/#/kanban', { waitUntil: 'networkidle', timeout: 15000 })
await page.waitForTimeout(2500)

// 1) 点 ＋ 新建
await page.locator('button', { hasText: '＋' }).first().click()
await page.waitForTimeout(800)
const newSheet = await page.evaluate(() => {
  const d = document.querySelector('[role="dialog"]')
  return d ? { opened: true, title: d.querySelector('h2')?.textContent } : { opened: false }
})
console.log('new sheet:', JSON.stringify(newSheet))

// 2) 填标题 + 创建
await page.locator('[role="dialog"] input, [role="dialog"] textarea').first().fill('kanban 验证任务')
await page.waitForTimeout(300)
const created = await page.evaluate(async () => {
  const d = document.querySelector('[role="dialog"]')
  const btn = Array.from(d?.querySelectorAll('button') ?? []).find(x => /创建/.test(x.textContent ?? '') && !x.disabled)
  if (!btn) return { clicked: false }
  btn.click()
  return { clicked: true }
})
console.log('create click:', JSON.stringify(created))
await page.waitForTimeout(2500)

// 3) 验证卡片出现在看板
const after = await page.evaluate(() => {
  const cards = Array.from(document.querySelectorAll('button')).filter(b2 => b2.textContent?.includes('kanban 验证任务'))
  return { found: cards.length, text: cards[0]?.textContent?.slice(0, 60) ?? null }
})
console.log('card after create:', JSON.stringify(after))

// 4) 打开详情 sheet
if (after.found) {
  await page.locator('button', { hasText: 'kanban 验证任务' }).first().click()
  await page.waitForTimeout(1500)
  const detail = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]')
    return d ? { opened: true, text: d.textContent?.slice(0, 150) } : { opened: false }
  })
  console.log('detail sheet:', JSON.stringify(detail))
}

console.log('js errors:', errors.length ? errors : 'none')
await b.close()
