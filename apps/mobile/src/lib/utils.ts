import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatRelativeTime(ts?: number | null): string {
  if (!ts) return ''
  const d = new Date(ts * 1000 > 1e12 ? ts : ts * 1000)
  const diff = Date.now() - d.getTime()
  const m = 60_000, h = 3600_000, day = 86400_000
  if (diff < m) return '刚刚'
  if (diff < h) return `${Math.floor(diff / m)}分前`
  if (diff < day) return `${Math.floor(diff / h)}小时前`
  if (diff < 7 * day) return `${Math.floor(diff / day)}天前`
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}
