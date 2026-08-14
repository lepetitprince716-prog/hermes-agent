// Instance switcher smoke: Mac / Z3 chips exist; default stays Mac.
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
await page.goto('http://127.0.0.1:5175/#/settings', { waitUntil: 'domcontentloaded', timeout: 15000 })
await page.waitForFunction(() => (document.querySelector('#root')?.childElementCount ?? 0) > 0, { timeout: 8000 })
await page.waitForTimeout(1200)
await page.screenshot({ path: '/tmp/mobile-instances.png', fullPage: true })

const info = await page.evaluate(() => {
  const buttons = Array.from(document.querySelectorAll('button')).map(el => el.textContent?.trim()).filter(Boolean)
  return {
    title: document.querySelector('h2')?.textContent?.trim() ?? null,
    hasMac: buttons.some(t => t === '本机 Mac'),
    hasZ3: buttons.some(t => t === 'Z3'),
    chip: Array.from(document.querySelectorAll('span')).map(el => el.textContent?.trim()).find(t => t === '本机 Mac' || t === 'Z3') ?? null,
    buttons,
  }
})
console.log(JSON.stringify(info, null, 2))
if (!info.hasMac || !info.hasZ3) throw new Error(`instance chips missing: ${JSON.stringify(info)}`)
await b.close()
