import { JsonRpcGatewayClient, type GatewayEvent, type ConnectionState } from '@hermes/shared'

import { resolveGatewayWsUrl, normalizeDashboardUrl, defaultDashboardUrl } from '@/lib/gateway-url'
import { $gatewayError, $gatewayState, $isStreaming, $messages, type ChatMessage } from '@/store/app'

let client: JsonRpcGatewayClient | null = null
let currentWsUrl: string | null = null
let lastDashboardInput: string | null = null
let connectPromise: Promise<void> | null = null
let unsubState: (() => void) | null = null
let unsubEvent: (() => void) | null = null

function rid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function ensureClient(): JsonRpcGatewayClient {
  if (client) return client
  client = new JsonRpcGatewayClient({
    requestTimeoutMs: 30_000,
    connectTimeoutMs: 15_000,
  })
  unsubState?.()
  unsubEvent?.()
  unsubState = client.onState((s: ConnectionState) => {
    $gatewayState.set(s)
    if (s === 'error' || s === 'closed') $isStreaming.set(false)
  })
  unsubEvent = client.onEvent((ev: GatewayEvent) => handleEvent(ev))
  return client
}

function pushMessages(updater: (prev: ChatMessage[]) => ChatMessage[]): void {
  const prev = $messages.get()
  $messages.set(updater(prev))
}

function handleEvent(ev: GatewayEvent): void {
  const type = ev.type
  const p = (ev.payload ?? ev) as Record<string, unknown>
  const sid = (ev.session_id as string | undefined) ?? (p.session_id as string | undefined)

  if (type === 'message.start' || type === 'message.delta' || type === 'thinking.delta' || type === 'reasoning.delta') {
    const text = (p.text as string) ?? (p.delta as string) ?? (p.content as string) ?? ''
    if (!text) return
    $isStreaming.set(true)
    const isThinking = type === 'thinking.delta' || type === 'reasoning.delta'
    pushMessages(prev => {
      const last = prev[prev.length - 1]
      if (last && last.role === 'assistant' && last.pending) {
        if (isThinking) return [...prev.slice(0, -1), { ...last, thinking: (last.thinking ?? '') + text }]
        return [...prev.slice(0, -1), { ...last, content: last.content + text }]
      }
      if (isThinking) return [...prev, { id: rid(), role: 'assistant', content: '', thinking: text, pending: true } as ChatMessage]
      return [...prev, { id: rid(), role: 'assistant', content: text, pending: true } as ChatMessage]
    })
    return
  }

  if (type === 'message.complete' || type === 'message.interim') {
    const text = (p.text as string) ?? (p.rendered as string) ?? ''
    const status = (p as { status?: string }).status
    const isError = status === 'error'
    pushMessages(prev => {
      const last = prev[prev.length - 1]
      if (last && last.role === 'assistant' && last.pending) {
        return [...prev.slice(0, -1), { ...last, content: text || last.content, pending: false, error: isError ? ((p.error as string) || 'error') : undefined }]
      }
      if (text) return [...prev, { id: rid(), role: 'assistant', content: text, error: isError ? 'error' : undefined } as ChatMessage]
      return prev
    })
    $isStreaming.set(false)
    if (sid && typeof sid === 'string') {
      window.dispatchEvent(new CustomEvent('hermes:session-id', { detail: { sessionId: sid } }))
    }
    return
  }

  if (type === 'tool.start') {
    const name = (p.name as string) ?? (p.tool as string) ?? 'tool'
    pushMessages(prev => [...prev, { id: rid(), role: 'tool', content: `◐ ${name}…`, pending: true } as ChatMessage])
    return
  }
  if (type === 'tool.complete' || type === 'tool.progress') {
    const result = (p.result as string) ?? (p.preview as string) ?? ''
    if (result) {
      pushMessages(prev => {
        const withoutPending = prev.filter(m => !(m.role === 'tool' && m.pending))
        return [...withoutPending, { id: rid(), role: 'tool', content: result.slice(0, 4000), pending: false } as ChatMessage]
      })
    } else {
      pushMessages(prev => prev.filter(m => !(m.role === 'tool' && m.pending)))
    }
    return
  }

  if (type === 'clarify.request' || type === 'approval.request' || type === 'sudo.request' || type === 'secret.request') {
    const question = (p.question as string) ?? (p.prompt as string) ?? (p.command as string) ?? JSON.stringify(p).slice(0, 500)
    const label = type === 'clarify.request' ? '需要确认' : type === 'approval.request' ? '危险操作确认' : '需要输入'
    window.dispatchEvent(new CustomEvent('hermes:prompt', { detail: { type, label, question, payload: p, sessionId: sid } }))
    return
  }

  if (type === 'status.update') {
    window.dispatchEvent(new CustomEvent('hermes:status', { detail: p }))
    return
  }

  if (type === 'error') {
    const msg = (p.message as string) ?? (p.error as string) ?? 'gateway error'
    $gatewayError.set(msg)
    $isStreaming.set(false)
    return
  }
}

export function getGatewayClient(): JsonRpcGatewayClient {
  return ensureClient()
}

async function doConnect(wsUrlOrDashboard: string): Promise<void> {
  const c = ensureClient()
  $gatewayState.set('connecting')
  $gatewayError.set(null)
  try {
    const wsUrl = await resolveGatewayWsUrl(wsUrlOrDashboard)
    currentWsUrl = wsUrl
    if (wsUrlOrDashboard) lastDashboardInput = wsUrlOrDashboard
    if (wsUrlOrDashboard) {
      localStorage.setItem('hermes-mobile-dashboard-url', normalizeDashboardUrl(wsUrlOrDashboard))
    }
    await c.connect(wsUrl)
  } catch (error) {
    $gatewayState.set('error')
    $gatewayError.set(error instanceof Error ? error.message : String(error))
    throw error
  }
}

/** 单飞 connect：并发调用共享同一个 promise，避免双连撞车。不传参则自动探测（vite/隧道走 /_dash）。 */
export async function connectGateway(wsUrlOrDashboard?: string): Promise<void> {
  const input = wsUrlOrDashboard?.trim() || ''
  if (input) lastDashboardInput = input
  if (client?.connectionState === 'open') return
  if (connectPromise) return connectPromise
  connectPromise = doConnect(input).finally(() => {
    connectPromise = null
  })
  return connectPromise
}

export function disconnectGateway(): void {
  if (client) {
    try { client.close() } catch { /* ignore */ }
  }
  $gatewayState.set('closed')
  $isStreaming.set(false)
  unsubState?.()
  unsubEvent?.()
  unsubState = null
  unsubEvent = null
  client = null
  currentWsUrl = null
}

export function gatewayState(): ConnectionState {
  return (client?.connectionState as ConnectionState) ?? 'idle'
}

/**
 * iOS / 后台回前台探活。WKWebView 可能静默杀 socket 且不发 close。
 * 非 open → 重连；open → 3s 短超时 RPC，失败则强制 close+重连。
 */
export async function ensureLiveness(): Promise<void> {
  const input = lastDashboardInput ?? defaultDashboardUrl()
  const state = client?.connectionState ?? $gatewayState.get()
  if (state !== 'open' || !client) {
    await connectGateway(input)
    return
  }
  try {
    await client.request('session.list', {}, 3000)
  } catch {
    disconnectGateway()
    await connectGateway(input)
  }
}

export async function gatewayRequest<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
  if (connectPromise) await connectPromise
  const c = ensureClient()
  if (c.connectionState !== 'open') {
    const input = lastDashboardInput ?? currentWsUrl ?? defaultDashboardUrl()
    await connectGateway(input)
  }
  const ready = client
  if (!ready || ready.connectionState !== 'open') {
    throw new Error('gateway not connected')
  }
  return await ready.request<T>(method, params)
}

export async function listSessions(): Promise<unknown> {
  return gatewayRequest('session.list', {})
}
export async function resumeSession(sessionId: string): Promise<unknown> {
  return gatewayRequest('session.resume', { session_id: sessionId })
}

function extractCreatedSessionId(res: unknown): string | null {
  if (!res || typeof res !== 'object') return null
  const r = res as Record<string, unknown>
  const id = r.session_id ?? r.stored_session_id
  return typeof id === 'string' && id ? id : null
}

/** 无 session 时先 session.create 再 prompt.submit，避免 session not found。 */
export async function sendPrompt(sessionId: string | null, text: string): Promise<{ session_id: string }> {
  let sid = sessionId
  if (!sid) {
    const created = await gatewayRequest('session.create', {})
    sid = extractCreatedSessionId(created)
    if (!sid) throw new Error('session.create 未返回 session_id')
    window.dispatchEvent(new CustomEvent('hermes:session-id', { detail: { sessionId: sid } }))
  }
  await gatewayRequest('prompt.submit', { session_id: sid, text })
  return { session_id: sid }
}

export async function interruptSession(sessionId: string): Promise<void> {
  await gatewayRequest('session.interrupt', { session_id: sessionId })
}
