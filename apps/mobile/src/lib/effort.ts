export const EFFORTS = ['none', 'low', 'medium', 'high', 'max'] as const
export type Effort = (typeof EFFORTS)[number]

export const DEFAULT_EFFORT: Effort = 'medium'

export const EFFORT_LABELS: Record<Effort, string> = {
  none: '关闭',
  low: '快速',
  medium: '标准',
  high: '深度',
  max: '极限',
}

export const EFFORT_HINTS: Record<Effort, string> = {
  none: '不走思考，直接答',
  low: '优先速度',
  medium: '日常默认',
  high: '复杂推理',
  max: '尽量想透',
}

const EFFORT_KEY = 'hermes-mobile-effort'

export function normalizeEffort(value?: string | null): Effort {
  const key = (value ?? '').trim().toLowerCase()
  if (key === 'off' || key === 'false') return 'none'
  if ((EFFORTS as readonly string[]).includes(key)) return key as Effort
  if (key === 'minimal') return 'low'
  if (key === 'xhigh' || key === 'ultra') return 'max'
  return DEFAULT_EFFORT
}

export function loadSavedEffort(): Effort {
  try {
    return normalizeEffort(localStorage.getItem(EFFORT_KEY))
  } catch {
    return DEFAULT_EFFORT
  }
}

export function saveEffort(effort: Effort): void {
  localStorage.setItem(EFFORT_KEY, effort)
}
