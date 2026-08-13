import './styles.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router'
import App from './App'
import { initTheme } from './themes'

try {
  initTheme()
  // keep system sync
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const cur = (localStorage.getItem('hermes-mobile-mode') as 'light' | 'dark' | 'system') ?? 'system'
    if (cur === 'system') initTheme()
  })
} catch {}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>
)
