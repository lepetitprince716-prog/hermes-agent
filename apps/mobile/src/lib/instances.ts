import { $currentInstanceId } from '@/store/app'

export type InstanceAuth = 'html-token' | 'manual-token'

export type HermesInstance = {
  id: string
  label: string
  hint: string
  /** Dashboard / serve origin. `/_dash` stays same-origin to this Mac. */
  base: string
  auth: InstanceAuth
}

export const INSTANCES: HermesInstance[] = [
  {
    id: 'mac',
    label: '本机 Mac',
    hint: '当前电脑上的 Hermes',
    base: '/_dash',
    auth: 'html-token',
  },
  {
    id: 'z3',
    label: 'Z3',
    hint: 'Windows · 127.0.0.1:19119',
    base: '/_z3',
    auth: 'manual-token',
  },
]

export const INSTANCE_KEY = 'hermes-mobile-instance'
export const TOKEN_PREFIX = 'hermes-mobile-token:'

export function findInstance(id?: string | null): HermesInstance {
  return INSTANCES.find(i => i.id === id) ?? INSTANCES[0]
}

export function loadSavedInstance(): HermesInstance {
  try {
    return findInstance(localStorage.getItem(INSTANCE_KEY))
  } catch {
    return INSTANCES[0]
  }
}

export function saveInstance(id: string): void {
  localStorage.setItem(INSTANCE_KEY, id)
  $currentInstanceId.set(id)
}

export function loadInstanceToken(id: string): string {
  try {
    return localStorage.getItem(`${TOKEN_PREFIX}${id}`) ?? ''
  } catch {
    return ''
  }
}

export function saveInstanceToken(id: string, token: string): void {
  const key = `${TOKEN_PREFIX}${id}`
  if (token.trim()) localStorage.setItem(key, token.trim())
  else localStorage.removeItem(key)
}
