import { atom } from 'nanostores'
import { useStore } from '@nanostores/react'

import { DEFAULT_THEME, THEME_LIST, type MobileTheme } from './presets'

export { THEME_LIST }

// ── 存储键（跟 desktop 对齐，方便将来同步）────────────────────────────────

const THEME_KEY = 'hermes-mobile-theme'
const MODE_KEY = 'hermes-mobile-mode'

// ── 状态 ──────────────────────────────────────────────────────────────────

export const $theme = atom<MobileTheme>(
  THEME_LIST.find(t => t.name === (localStorage.getItem(THEME_KEY) ?? DEFAULT_THEME)) ?? THEME_LIST[0],
)
export const $themeMode = atom<'light' | 'dark' | 'system'>(
  (localStorage.getItem(MODE_KEY) as 'light' | 'dark' | 'system') ?? 'system',
)

// ── 应用主题 ──────────────────────────────────────────────────────────────

function resolveMode(mode: 'light' | 'dark' | 'system'): 'light' | 'dark' {
  if (mode === 'system') {
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return mode
}

export function applyTheme(theme: MobileTheme, mode: 'light' | 'dark' | 'system'): void {
  const resolved = resolveMode(mode)
  const isDark = resolved === 'dark'
  const c = isDark && theme.darkColors ? theme.darkColors : theme.colors

  const root = document.documentElement
  root.classList.toggle('dark', isDark)
  root.dataset.hermesTheme = theme.name
  root.dataset.hermesMode = resolved

  // 写入 CSS 变量 — 跟 desktop styles.css 的 @theme inline 对应
  const vars: Record<string, string> = {
    '--dt-background': c.background,
    '--dt-foreground': c.foreground,
    '--dt-card': c.card,
    '--dt-card-foreground': c.cardForeground,
    '--dt-muted': c.muted,
    '--dt-muted-foreground': c.mutedForeground,
    '--dt-popover': c.popover,
    '--dt-popover-foreground': c.popoverForeground,
    '--dt-primary': c.primary,
    '--dt-primary-foreground': c.primaryForeground,
    '--dt-secondary': c.secondary,
    '--dt-secondary-foreground': c.secondaryForeground,
    '--dt-accent': c.accent,
    '--dt-accent-foreground': c.accentForeground,
    '--dt-border': c.border,
    '--dt-input': c.input,
    '--dt-ring': c.ring,
    '--dt-midground': c.midground,
    '--dt-destructive': c.destructive,
    '--dt-destructive-foreground': c.destructiveForeground,
    '--dt-sidebar-background': c.sidebarBackground,
    '--dt-sidebar-border': c.sidebarBorder,
    '--dt-user-bubble': c.userBubble,
    '--dt-user-bubble-border': c.userBubbleBorder,
    '--radius': '0.75rem',
    '--font-mono': theme.fontMono ?? 'ui-monospace, "SF Mono", Menlo, Monaco, monospace',
  }

  for (const [k, v] of Object.entries(vars)) {
    root.style.setProperty(k, v)
  }

  // boot 防白闪（desktop index.html 同款）
  localStorage.setItem('hermes-boot-background', c.background)
  localStorage.setItem('hermes-boot-color-scheme', resolved)
}

// ── 对外 API ──────────────────────────────────────────────────────────────

export function setTheme(name: string): void {
  const theme = THEME_LIST.find(t => t.name === name)
  if (!theme) return
  $theme.set(theme)
  localStorage.setItem(THEME_KEY, name)
  applyTheme(theme, $themeMode.get())
}

export function setThemeMode(mode: 'light' | 'dark' | 'system'): void {
  $themeMode.set(mode)
  localStorage.setItem(MODE_KEY, mode)
  applyTheme($theme.get(), mode)
}

export function initTheme(): void {
  const themeName = localStorage.getItem(THEME_KEY) ?? DEFAULT_THEME
  const theme = THEME_LIST.find(t => t.name === themeName) ?? THEME_LIST[0]
  $theme.set(theme)
  applyTheme(theme, $themeMode.get())
}

// ── React Hook ────────────────────────────────────────────────────────────

export function useTheme() {
  const theme = useStore($theme)
  const mode = useStore($themeMode)
  return { theme, mode, setTheme, setThemeMode }
}
