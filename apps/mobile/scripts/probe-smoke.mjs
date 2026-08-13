// Hermes mobile smoke: mount + connect + sessions/chat/settings
import { chromium } from 'playwright'
import path from 'path'
import os from 'os'
import fs from 'fs'

const candidates = [
  path.join(os.homedir(), 'Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell'),
]
const found = fs.readdirSync(path.join(os.homedir(), 'Library/Caches/ms-playwright'))
  .filter(n => n.startsWith('chromium_headless_shell-'))
  .map(n => path.join(os.homedir(), 'Library/Caches/ms-playwright', n, 'chrome-headless-shell-mac-arm64/chrome-headless-shell'))
const exe = [...candidates, ...found].find(p => fs.existsSync(p))
if (!exe) throw new Error('no playwright chromium_headless_shell')

const b = await chromium.launch({ headless: true, executablePath: exe })
const page = await b.newPage({ viewport: { width: 390, height: 844 } })
const errors = []
const failed = []
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`))
page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`) })
page.on('requestfailed', r => failed.push(`${r.method()} ${r.url()} ${r.failure()?.errorText}`))

async function shot(name) {
  const p = `/tmp/mobile-${name}.png`
  await page.screenshot({ path: p, fullPage: true })
  return p
}

function badgeText() {
  return page.evaluate(() => {
    const root = document.querySelector('#root')
    const badge = Array.from(document.querySelectorAll('span'))
      .find(s => ['已连接', '未连接', '连接中', '错误'].includes((s.textContent ?? '').trim()))
    return {
      rootChildren: root?.childElementCount ?? 0,
      badge: badge?.textContent?.trim() ?? null,
      body: document.body.innerText.slice(0, 400),
    }
  })
}

await page.goto('http://127.0.0.1:5175/#/', { waitUntil: 'domcontentloaded', timeout: 15000 })
await page.waitForFunction(() => (document.querySelector('#root')?.childElementCount ?? 0) > 0, { timeout: 8000 })
await page.waitForTimeout(2500)
const chat = await badgeText()
const chatShot = await shot('chat')

await page.goto('http://127.0.0.1:5175/#/sessions', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2500)
const sessions = await badgeText()
const sessionsCount = await page.evaluate(() => document.querySelectorAll('li').length)
const sessionsErr = await page.evaluate(() => document.querySelector('.text-red-500')?.textContent ?? null)
const sessionsShot = await shot('sessions')

await page.goto('http://127.0.0.1:5175/#/settings', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1500)
const about = await page.evaluate(() => document.body.innerText)
const settingsShot = await shot('settings')

await page.goto('http://127.0.0.1:5175/#/kanban', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(3000)
const kanban = await badgeText()
const kanbanErr = await page.evaluate(() => document.querySelector('.text-red-500')?.textContent ?? null)
const kanbanShot = await shot('kanban')

console.log(JSON.stringify({
  chat,
  sessions: { ...sessions, rows: sessionsCount, error: sessionsErr },
  kanban: { ...kanban, error: kanbanErr },
  aboutHasV02: about.includes('v0.2'),
  aboutHasKanban: about.includes('看板'),
  jsErrors: errors,
  requestFailed: failed.slice(0, 12),
  shots: { chatShot, sessionsShot, settingsShot, kanbanShot },
}, null, 2))
await b.close()
