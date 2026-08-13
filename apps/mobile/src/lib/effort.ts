export const EFFORTS = ['none', 'low', 'medium', 'high', 'max'] as const
export type Effort = (typeof EFFORTS)[number]

export const DEFAULT_EFFORT: Effort = 'medium'

export const EFFORT_LABELS: Record<Effort, string> = {
  none: 'Off',
  low: 'Low',
  medium: 'Med',
  high: 'High',
  max: 'Max',
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
