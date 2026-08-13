/**
 * Mobile theme —照抄 desktop Nous 主题。
 *
 * Desktop 的主题系统：presets.ts 定义主题（colors + darkColors + typography），
 * context.tsx 通过 applyTheme() 把 seed 写入 CSS 变量，styles.css 用
 * @theme inline 把变量映射为 Tailwind token。
 *
 * 移动端复刻同一结构，但做了两个简化：
 * 1. 不跑 VS Code 主题转换器（太重，移动端先只带内置主题）
 * 2. 不跑 Electron native sync（没有 Electron）
 *
 * 对外 API 跟 desktop 的 themes/context.tsx 对齐：
 *   - $theme: atom<string>（主题名）
 *   - $themeMode: atom<'light' | 'dark' | 'system'>
 *   - applyTheme(): 应用主题到 :root
 *   - THEME_LIST: 可用主题列表
 */

export interface MobileThemeColors {
  background: string
  foreground: string
  card: string
  cardForeground: string
  muted: string
  mutedForeground: string
  popover: string
  popoverForeground: string
  primary: string
  primaryForeground: string
  secondary: string
  secondaryForeground: string
  accent: string
  accentForeground: string
  border: string
  input: string
  ring: string
  midground: string
  destructive: string
  destructiveForeground: string
  sidebarBackground: string
  sidebarBorder: string
  userBubble: string
  userBubbleBorder: string
}

export interface MobileTheme {
  name: string
  label: string
  description: string
  colors: MobileThemeColors
  darkColors?: MobileThemeColors
  fontMono?: string
}

// ── Nous 主题（desktop 的 canonical identity）─────────────────────────────

const NOUS_BLUE = '#0053FD'
const PSYCHE_WARM = '#FFE6CB'
const PSYCHE_BLUE = '#1540B1'

const nousTint = (pct: number) => `color-mix(in srgb, ${NOUS_BLUE} ${pct}%, #FFFFFF)`
const nousTintTransparent = (pct: number) => `color-mix(in srgb, ${NOUS_BLUE} ${pct}%, transparent)`

export const nousTheme: MobileTheme = {
  name: 'nous',
  label: 'Nous',
  description: 'Glass neutrals with Nous blue accents',
  colors: {
    background: '#F8FAFF',
    foreground: '#17171A',
    card: '#FFFFFF',
    cardForeground: '#17171A',
    muted: nousTint(5),
    mutedForeground: '#666678',
    popover: '#FFFFFF',
    popoverForeground: '#17171A',
    primary: NOUS_BLUE,
    primaryForeground: '#FCFCFC',
    secondary: nousTint(7),
    secondaryForeground: '#242432',
    accent: nousTint(10),
    accentForeground: '#202030',
    border: nousTintTransparent(22),
    input: nousTintTransparent(30),
    ring: NOUS_BLUE,
    midground: NOUS_BLUE,
    destructive: '#C72E4D',
    destructiveForeground: '#FFFFFF',
    sidebarBackground: '#F3F7FF',
    sidebarBorder: nousTintTransparent(18),
    userBubble: nousTint(6),
    userBubbleBorder: nousTintTransparent(24),
  },
  darkColors: {
    background: '#0D2F86',
    foreground: PSYCHE_WARM,
    card: '#12378F',
    cardForeground: PSYCHE_WARM,
    muted: '#183F9A',
    mutedForeground: '#B5C7F3',
    popover: '#123A96',
    popoverForeground: PSYCHE_WARM,
    primary: PSYCHE_WARM,
    primaryForeground: '#0D2F86',
    secondary: '#1B45A4',
    secondaryForeground: '#E0E8FF',
    accent: PSYCHE_BLUE,
    accentForeground: '#F0F4FF',
    border: '#3158AD',
    input: '#0B2566',
    ring: PSYCHE_WARM,
    midground: NOUS_BLUE,
    destructive: '#C0473A',
    destructiveForeground: '#FEF2F2',
    sidebarBackground: '#09286F',
    sidebarBorder: '#234A9C',
    userBubble: '#143B91',
    userBubbleBorder: '#3A63BD',
  },
}

// ── Midnight ─────────────────────────────────────────────────────────────

export const midnightTheme: MobileTheme = {
  name: 'midnight',
  label: 'Midnight',
  description: 'Deep blue-violet with cool accents',
  colors: {
    background: '#08081c',
    foreground: '#ddd6ff',
    card: '#0d0d28',
    cardForeground: '#ddd6ff',
    muted: '#13133a',
    mutedForeground: '#7c7ab0',
    popover: '#0f0f2e',
    popoverForeground: '#ddd6ff',
    primary: '#ddd6ff',
    primaryForeground: '#08081c',
    secondary: '#1a1a4a',
    secondaryForeground: '#c4bff0',
    accent: '#1a1a44',
    accentForeground: '#d0c8ff',
    border: '#1e1e52',
    input: '#1e1e52',
    ring: '#8b80e8',
    midground: '#8b80e8',
    destructive: '#b03060',
    destructiveForeground: '#fef2f2',
    sidebarBackground: '#06061a',
    sidebarBorder: '#12123a',
    userBubble: '#14143a',
    userBubbleBorder: '#242466',
  },
}

// ── Mono ─────────────────────────────────────────────────────────────────

export const monoTheme: MobileTheme = {
  name: 'mono',
  label: 'Mono',
  description: 'Clean grayscale — minimal and focused',
  colors: {
    background: '#0e0e0e',
    foreground: '#eaeaea',
    card: '#141414',
    cardForeground: '#eaeaea',
    muted: '#1e1e1e',
    mutedForeground: '#808080',
    popover: '#181818',
    popoverForeground: '#eaeaea',
    primary: '#eaeaea',
    primaryForeground: '#0e0e0e',
    secondary: '#262626',
    secondaryForeground: '#c8c8c8',
    accent: '#222222',
    accentForeground: '#d8d8d8',
    border: '#2a2a2a',
    input: '#2a2a2a',
    ring: '#9a9a9a',
    midground: '#9a9a9a',
    destructive: '#a84040',
    destructiveForeground: '#fef2f2',
    sidebarBackground: '#0a0a0a',
    sidebarBorder: '#202020',
    userBubble: '#1a1a1a',
    userBubbleBorder: '#363636',
  },
}

// ── 注册表 ───────────────────────────────────────────────────────────────

export const THEME_LIST: MobileTheme[] = [nousTheme, midnightTheme, monoTheme]
export const DEFAULT_THEME = 'nous'

const THEME_MAP: Record<string, MobileTheme> = Object.fromEntries(
  THEME_LIST.map(t => [t.name, t]),
)
