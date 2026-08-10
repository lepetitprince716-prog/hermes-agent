import { atom } from 'nanostores'
export const $theme = atom<'light' | 'dark' | 'system'>(
  (localStorage.getItem('hermes-mobile-theme') as 'light' | 'dark' | 'system') ?? 'system'
)

export function applyTheme(mode: 'light' | 'dark' | 'system') {
  $theme.set(mode)
  localStorage.setItem('hermes-mobile-theme', mode)
  const resolved = mode === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : mode
  document.documentElement.classList.toggle('dark', resolved === 'dark')
  localStorage.setItem('hermes-boot-color-scheme', resolved)
  localStorage.setItem('hermes-boot-background', resolved === 'dark' ? '#111111' : '#f7f7f7')
}
