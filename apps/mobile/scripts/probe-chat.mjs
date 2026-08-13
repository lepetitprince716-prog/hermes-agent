// Visual check: empty state (wordmark only) + seeded conversation bubbles.
import { chromium } from 'playwright'
import path from 'path'
import os from 'os'
import fs from 'fs'

const found = fs.readdirSync(path.join(os.homedir(), 'Library/Caches/ms-playwright'))
  .filter(n => n.startsWith('chromium_headless_shell-'))
  .map(n => path.join(os.homedir(), 'Library/Caches/ms-playwright', n, 'chrome-headless-shell-mac-arm64/chrome-headless-shell'))
const exe = found.find(p => fs.existsSync(p))
if (!exe) throw new Error('no playwright chromium_headless_shell')

const SAMPLE = [
  { id: 'u1', role: 'user', content: '把这次改动的验收口径写清楚。' },
  {
    id: 'a1',
    role: 'assistant',
    content: '验收以 typecheck 和 headless probe 为准。\n\n- 空状态只保留 **HERMES AGENT** 字标\n- 用户消息用浅色气泡右对齐\n- 助手回复无框，走 Markdown',
  },
  { id: 'u2', role: 'user', content: '选择器透明度保持现状即可。' },
  { id: 'a2', role: 'assistant', content: '已记录。弹层继续用毛玻璃，蓝底透出即可。' },
]

const b = await chromium.launch({ headless: true, executablePath: exe })

async function shot(viewport, name, seed) {
  const page = await b.newPage({ viewport })
  await page.goto('http://127.0.0.1:5175/#/', { waitUntil: 'domcontentloaded', timeout: 15000 })
  await page.waitForFunction(() => (document.querySelector('#root')?.childElementCount ?? 0) > 0, { timeout: 8000 })
  await page.waitForTimeout(800)
  if (seed) {
    await page.evaluate(messages => {
      const root = document.querySelector('#root')
      const ev = new CustomEvent('hermes:preview-messages', { detail: messages })
      window.dispatchEvent(ev)
      if (!root) return
    }, SAMPLE)
    await page.waitForTimeout(400)
  }
  await page.screenshot({ path: `/tmp/${name}`, fullPage: false })
  const info = await page.evaluate(() => ({
    wordmark: document.querySelector('.wordmark')?.textContent?.trim() ?? null,
    girl: Boolean(document.querySelector('img[src*="nous-girl"]')),
    placeholder: document.querySelector('textarea')?.getAttribute('placeholder') ?? null,
    userBubbles: document.querySelectorAll('.chat-user-bubble').length,
    assistant: Array.from(document.querySelectorAll('.self-stretch')).length,
  }))
  await page.close()
  return info
}

const emptyPhone = await shot({ width: 390, height: 844 }, 'mobile-empty.png', false)
const emptyDesk = await shot({ width: 1280, height: 820 }, 'desktop-empty.png', false)
const chatPhone = await shot({ width: 390, height: 844 }, 'mobile-chat.png', true)
const chatDesk = await shot({ width: 1280, height: 820 }, 'desktop-chat.png', true)

console.log(JSON.stringify({ emptyPhone, emptyDesk, chatPhone, chatDesk }, null, 2))
if (emptyPhone.girl || emptyDesk.girl) throw new Error('nous-girl still visible')
if (!emptyPhone.wordmark || !emptyDesk.wordmark) throw new Error('wordmark missing')
if (chatPhone.userBubbles < 2 || chatDesk.userBubbles < 2) {
  throw new Error(`user bubbles missing: phone=${chatPhone.userBubbles} desk=${chatDesk.userBubbles}`)
}
await b.close()
