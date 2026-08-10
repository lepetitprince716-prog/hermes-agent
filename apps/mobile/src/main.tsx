import './styles.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router'

import App from './App'
import { applyTheme } from './themes'

try {
  const saved = (localStorage.getItem('hermes-mobile-theme') as 'light' | 'dark' | 'system') ?? 'system'
  applyTheme(saved)
  // keep system sync
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const cur = (localStorage.getItem('hermes-mobile-theme') as 'light' | 'dark' | 'system') ?? 'system'

    if (cur === 'system') {applyTheme('system')}
  })
} catch { /* 主题初始化失败不阻塞启动 */ }

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>
)
