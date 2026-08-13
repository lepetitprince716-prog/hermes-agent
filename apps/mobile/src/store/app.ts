import { atom, computed } from 'nanostores'

export type SessionInfo = {
  id: string
  title?: string | null
  preview?: string | null
  updated_at?: number | null
  created_at?: number | null
  profile?: string | null
  // extra fields gateway 可能返回
  status?: string
  model?: string
  provider?: string
  tokens?: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [k: string]: any
}

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  timestamp?: number
  pending?: boolean
  error?: string
  // for assistant streaming parts
  thinking?: string
  toolCalls?: { id: string; name: string; args: unknown; result?: unknown }[]
}

export const $sessions = atom<SessionInfo[]>([])
export const $selectedSessionId = atom<string | null>(null)
export const $messages = atom<ChatMessage[]>([])
export const $isStreaming = atom(false)
export const $gatewayState = atom<'idle' | 'connecting' | 'open' | 'closed' | 'error'>('idle')
export const $gatewayError = atom<string | null>(null)
export const $composerText = atom('')

export const $selectedSession = computed([$sessions, $selectedSessionId], (sessions, id) =>
  id ? (sessions.find(s => s.id === id) ?? null) : null
)

export const $sessionsSorted = computed($sessions, sessions =>
  [...sessions].sort((a, b) => (b.updated_at ?? 0) - (a.updated_at ?? 0))
)

export function sessionTitle(s: SessionInfo): string {
  return (s.title?.trim() || s.preview?.trim() || '新会话').slice(0, 80)
}
