// 检查 mobile 页面 CSS 变量（在 repo 内跑，能找到 node_modules）
import { chromium } from 'playwright'
import path from 'path'
import os from 'os'

const exe = path.join(os.homedir(), 'Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell')

async function check(mode) {
  const b = await chromium.launch({ headless: true, executablePath: exe })
  const page = await b.newPage({ viewport: { width: 390, height: 844 } })
  await page.goto('http://127.0.0.1:5175', { waitUntil: 'networkidle', timeout: 15000 })
  if (mode === 'dark') {
    await page.evaluate(() => {
      localStorage.setItem('hermes-mobile-mode', 'dark')
      location.reload()
    })
    await page.waitForTimeout(2000)
  } else {
    await page.waitForTimeout(1500)
  }
  const vars = await page.evaluate(() => {
    const root = document.documentElement
    const s = getComputedStyle(root)
    return {
      theme: root.dataset.hermesTheme,
      mode: root.dataset.hermesMode,
      dark: root.classList.contains('dark'),
      bg: s.getPropertyValue('--dt-background'),
      fg: s.getPropertyValue('--dt-foreground'),
      card: s.getPropertyValue('--dt-card'),
      primary: s.getPropertyValue('--dt-primary'),
      bubble: s.getPropertyValue('--dt-user-bubble'),
    }
  })
  console.log(mode, JSON.stringify(vars, null, 2))
  await b.close()
}

(async () => {
  await check('light')
  await check('dark')
})()
