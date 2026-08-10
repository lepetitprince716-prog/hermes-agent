import { type ConnectionState, type GatewayEvent, JsonRpcGatewayClient } from '@hermes/shared'

import { normalizeDashboardUrl, resolveGatewayWsUrl } from '@/lib/gateway-url'
import { $gatewayError, $gatewayState, $isStreaming, $messages, type ChatMessage } from '@/store/app'

let client: JsonRpcGatewayClient | null = null
let currentWsUrl: string | null = null
let currentInput: string | null = null
let unsubState: (() => void) | null = null
let unsubEvent: (() => void) | null = null
let manualClose = false
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let reconnectAttempt = 0
let connectPromise: Promise<void> | null = null

function rid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** 指数退避：1s → 2s → 5s → 10s → 30s 封顶 */
function reconnectDelay(attempt: number): number {
  const seq = [1000, 2000, 5000, 10_000, 30_000]

  return seq[Math.min(attempt, seq.length - 1)]
}

function scheduleReconnect(): void {
  if (manualClose || !currentInput || reconnectTimer) {return}
  const delay = reconnectDelay(reconnectAttempt++)
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null

    if (manualClose || !currentInput) {return}
    connectGateway(currentInput).catch(() => {
      // 失败后 onState('error') 会再次进入 scheduleReconnect
    })
  }, delay)
}

function ensureClient(): JsonRpcGatewayClient {
  if (client) {return client}
  client = new JsonRpcGatewayClient({
    requestTimeoutMs: 30_000,
    connectTimeoutMs: 15_000,
  })
  unsubState?.()
  unsubEvent?.()
  unsubState = client.onState((s: ConnectionState) => {
    $gatewayState.set(s)

    if (s === 'open') {reconnectAttempt = 0}

    if (s === 'error' || s === 'closed') {
      $isStreaming.set(false)
      scheduleReconnect()
    }
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

    if (!text) {return}
    $isStreaming.set(true)
    const isThinking = type === 'thinking.delta' || type === 'reasoning.delta'
    pushMessages(prev => {
      const last = prev[prev.length - 1]

      if (last && last.role === 'assistant' && last.pending) {
        if (isThinking) {return [...prev.slice(0, -1), { ...last, thinking: (last.thinking ?? '') + text }]}

        return [...prev.slice(0, -1), { ...last, content: last.content + text }]
      }

      if (isThinking) {return [...prev, { id: rid(), role: 'assistant', content: '', thinking: text, pending: true } as ChatMessage]}

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

      if (text) {return [...prev, { id: rid(), role: 'assistant', content: text, error: isError ? 'error' : undefined } as ChatMessage]}

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

export async function connectGateway(wsUrlOrDashboard: string): Promise<void> {
  // 单飞：连接进行中时并发调用共用同一 promise，避免双 connect 竞态
  if (connectPromise) {return connectPromise}
  connectPromise = connectGatewayInner(wsUrlOrDashboard).finally(() => { connectPromise = null })

  return connectPromise
}

async function connectGatewayInner(wsUrlOrDashboard: string): Promise<void> {
  const c = ensureClient()
  manualClose = false

  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
  $gatewayState.set('connecting')
  $gatewayError.set(null)

  try {
    const wsUrl = await resolveGatewayWsUrl(wsUrlOrDashboard)
    currentWsUrl = wsUrl
    currentInput = wsUrlOrDashboard
    localStorage.setItem('hermes-mobile-dashboard-url', normalizeDashboardUrl(wsUrlOrDashboard))
    await c.connect(wsUrl)
  } catch (error) {
    $gatewayState.set('error')
    $gatewayError.set(error instanceof Error ? error.message : String(error))
    throw error
  }
}

export function disconnectGateway(): void {
  manualClose = true

  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }

  if (client) {
    try { client.close() } catch { /* 关闭尽力而为 */ }
  }

  $gatewayState.set('closed')
  $isStreaming.set(false)
  unsubState?.()
  unsubEvent?.()
  unsubState = null
  unsubEvent = null
  client = null
}

// ---------------------------------------------------------------------------
// 前台探活 — iOS WKWebView 后台会静默挂起/杀死 socket，close 事件可能永远
// 不触发（状态停在 'open' 的僵尸连接）。回到前台时必须主动验证：
// 非 open → 立即重连（重置退避）；open → 3s 短超时 RPC 探活，失败强制重连。
// ---------------------------------------------------------------------------

let probeInFlight = false

export function ensureLiveness(): void {
  if (probeInFlight || manualClose || !currentInput) {return}
  probeInFlight = true

  void (async () => {
    try {
      const c = ensureClient()

      if (c.connectionState !== 'open') {
        reconnectAttempt = 0
        await connectGateway(currentInput as string)

        return
      }

      await Promise.race([
        c.request('session.list', {}),
        new Promise((_, rej) => { setTimeout(() => { rej(new Error('liveness timeout')) }, 3000) }),
      ])
    } catch {
      // 僵尸连接实锤：拆掉立即重连
      try { client?.close() } catch { /* 忽略 */ }
      reconnectAttempt = 0

      if (currentInput) {await connectGateway(currentInput).catch(() => {})}
    } finally {
      probeInFlight = false
    }
  })()
}

export function gatewayState(): ConnectionState {
  return (client?.connectionState as ConnectionState) ?? 'idle'
}

export async function gatewayRequest<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
  const c = ensureClient()

  if (c.connectionState !== 'open') {
    // 连接进行中 → 等它完成；否则走完整 connect 路径（重新刮 token）
    if (connectPromise) {await connectPromise}
    else if (currentInput) {await connectGateway(currentInput)}
    else if (currentWsUrl) {await c.connect(currentWsUrl)}
    else {throw new Error('gateway not connected')}
  }

  return (await c.request(method, params)) as T
}

export async function listSessions(): Promise<unknown> {
  return gatewayRequest('session.list', {})
}

export async function resumeSession(sessionId: string): Promise<unknown> {
  return gatewayRequest('session.resume', { session_id: sessionId })
}

export async function sendPrompt(sessionId: string | null, text: string): Promise<unknown> {
  if (sessionId) {return gatewayRequest('prompt.submit', { session_id: sessionId, text })}

  return gatewayRequest('prompt.submit', { text })
}

export async function interruptSession(sessionId: string): Promise<unknown> {
  return gatewayRequest('session.interrupt', { session_id: sessionId })
}
