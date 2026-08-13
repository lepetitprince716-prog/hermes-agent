import { useStore } from '@nanostores/react'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { $currentEffort, $currentModel, $currentProvider, $isStreaming, $messages, type ChatMessage } from '@/store/app'
import { gatewayRequest, interruptSession, sendPrompt } from '@/lib/gateway'
import { $gatewayState } from '@/store/app'
import { cn } from '@/lib/utils'
import { ModelPicker, usePickedEffort, usePickedModel } from '@/components/ModelPicker'
import { IconArrowUp, IconStop } from '@/components/icons'

const Markdown = lazy(() => import('@/components/Markdown').then(m => ({ default: m.Markdown })))

export default function ChatPage({ sessionId }: { sessionId: string | null }) {
  const messages = useStore($messages)
  const isStreaming = useStore($isStreaming)
  const gatewayState = useStore($gatewayState)
  const scrollerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!sessionId) {
      $messages.set([])
      return
    }
    if (gatewayState !== 'open') return
    let cancelled = false
    gatewayRequest('session.resume', { session_id: sessionId })
      .then((res: unknown) => {
        if (cancelled) return
        const r = res as Record<string, unknown>
        const info = (r.info && typeof r.info === 'object') ? r.info as Record<string, unknown> : r
        const model = typeof info.model === 'string' ? info.model : ''
        const provider = typeof info.provider === 'string' ? info.provider : ''
        const effort = typeof info.reasoning_effort === 'string' ? info.reasoning_effort : ''
        if (model) $currentModel.set(model)
        if (provider) $currentProvider.set(provider)
        if (effort) $currentEffort.set(effort)
        const history = (r.messages ?? r.history ?? (r.result as Record<string, unknown> | undefined)?.messages ?? []) as Array<{
          role: string
          content: string
          text?: string
        }>
        if (Array.isArray(history) && history.length) {
          $messages.set(
            history.map((h, i) => ({
              id: `${sessionId}-${i}`,
              role: (h.role as ChatMessage['role']) ?? 'assistant',
              content: (h.content ?? h.text ?? '') as string,
            })),
          )
        } else {
          $messages.set([])
        }
      })
      .catch(() => {
        if (!cancelled) $messages.set([])
      })
    return () => { cancelled = true }
  }, [sessionId, gatewayState])

  return (
    <div className="flex flex-1 flex-col">
      <div ref={scrollerRef} className="flex-1 overflow-y-auto px-3 py-3">
        {messages.length === 0 ? (
          <div className="mx-auto flex max-w-[640px] flex-col items-center px-4 pt-[14vh] text-center">
            <div className="wordmark text-[clamp(2.4rem,8vw,4.6rem)] text-midground">Hermes Agent</div>
            <p className="mt-4 text-[15px] tracking-tight text-muted-foreground">选好模型和思考深度，直接发就行。</p>
          </div>
        ) : (
          <div className="mx-auto flex max-w-[720px] flex-col gap-3">
            {messages.map(m => (
              <div
                key={m.id}
                className={cn(
                  'px-1 py-2 text-[15px] leading-6',
                  m.role === 'user' ? 'self-end max-w-[85%] text-right' : '',
                  m.role === 'tool' ? 'font-mono text-xs text-muted-foreground' : null,
                  m.error ? 'text-red-500' : null,
                )}
              >
                {m.thinking ? (
                  <details className="mb-1 text-xs opacity-70">
                    <summary>思考过程</summary>
                    <div className="whitespace-pre-wrap">{m.thinking}</div>
                  </details>
                ) : null}
                {m.role === 'assistant' ? (
                  <Suspense fallback={<div className="whitespace-pre-wrap break-words">{m.content}</div>}>
                    <Markdown text={m.content} streaming={Boolean(m.pending)} />
                  </Suspense>
                ) : (
                  <div className="whitespace-pre-wrap break-words">{m.content}</div>
                )}
                {m.pending ? <span className="mt-1 inline-block size-2 animate-pulse rounded-full bg-muted-foreground" /> : null}
              </div>
            ))}
          </div>
        )}
      </div>
      <Composer sessionId={sessionId} />
    </div>
  )
}

function Composer({ sessionId }: { sessionId: string | null }) {
  const gatewayState = useStore($gatewayState)
  const isStreaming = useStore($isStreaming)
  const picked = usePickedModel()
  const effort = usePickedEffort()
  const [text, setText] = useState('')
  const canSend = text.trim().length > 0 && gatewayState === 'open' && !isStreaming

  const onSend = async () => {
    const t = text.trim()
    if (!t || !canSend) return
    $messages.set([...$messages.get(), { id: `${Date.now()}`, role: 'user', content: t } as ChatMessage])
    setText('')
    try {
      await sendPrompt(sessionId, t, { provider: picked.provider, model: picked.model, effort })
    } catch (e) {
      $messages.set([
        ...$messages.get(),
        { id: `${Date.now()}`, role: 'assistant', content: `发送失败：${e instanceof Error ? e.message : String(e)}`, error: 'send_failed' } as ChatMessage,
      ])
    }
  }

  const onStop = async () => {
    if (!sessionId) return
    try {
      await interruptSession(sessionId)
    } catch { /* 停不了就等 complete */ }
  }

  return (
    <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] bg-transparent px-3 pb-3 pt-2 md:bottom-0 md:px-6 md:pb-6">
      <div className="mx-auto flex max-w-[720px] flex-wrap items-center gap-x-1 gap-y-1 rounded-full bg-[color-mix(in_srgb,var(--dt-background)_82%,var(--dt-foreground)_7%)] px-2 py-1.5 md:flex-nowrap md:px-3">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void onSend() }
          }}
          placeholder={gatewayState !== 'open' ? '网络未连接，无法发送' : '想问什么？'}
          rows={1}
          className="order-1 max-h-28 min-h-9 min-w-[10rem] flex-1 resize-none bg-transparent px-2 py-1.5 text-[15px] leading-6 outline-none placeholder:text-muted-foreground/70"
        />
        <div className="order-3 min-w-0 md:order-2">
          <ModelPicker sessionId={sessionId} variant="inline" />
        </div>
        {isStreaming ? (
          <button
            onClick={() => void onStop()}
            disabled={!sessionId}
            aria-label="停止"
            className="order-2 grid size-9 shrink-0 place-items-center rounded-full bg-red-600 text-white transition-transform active:scale-[0.97] disabled:opacity-40 md:order-3"
          >
            <span className="block"><IconStop /></span>
          </button>
        ) : (
          <button
            onClick={() => void onSend()}
            disabled={!canSend}
            aria-label="发送"
            className="order-2 grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-[0.97] disabled:opacity-30 md:order-3"
          >
            <IconArrowUp />
          </button>
        )}
      </div>
    </div>
  )
}
