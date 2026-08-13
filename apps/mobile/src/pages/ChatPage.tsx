import { useStore } from '@nanostores/react'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { $isStreaming, $messages, type ChatMessage } from '@/store/app'
import { gatewayRequest, interruptSession, sendPrompt } from '@/lib/gateway'
import { $gatewayState } from '@/store/app'
import { cn } from '@/lib/utils'

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
          <div className="mx-auto max-w-[520px] rounded-2xl border bg-card p-5 text-sm leading-6">
            <div className="text-sm font-semibold">Hermes Mobile</div>
            <p className="mt-1 text-muted-foreground">
              与 desktop 同一 gateway、同一 WS 协议。聊天、项目、看板、统计都在底部。
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              当前会话：{sessionId ?? '新会话'} {isStreaming ? '· 正在生成…' : ''}
            </p>
          </div>
        ) : (
          <div className="mx-auto flex max-w-[720px] flex-col gap-3">
            {messages.map(m => (
              <div
                key={m.id}
                className={cn(
                  'rounded-2xl border px-3.5 py-2.5 text-[14px] leading-6',
                  m.role === 'user' ? 'self-end max-w-[85%] chat-user-bubble' : 'bg-card',
                  m.role === 'tool' ? 'border-dashed bg-muted/50 font-mono text-xs' : null,
                  m.error ? 'border-red-300' : null,
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
  const [text, setText] = useState('')
  const canSend = text.trim().length > 0 && gatewayState === 'open' && !isStreaming

  const onSend = async () => {
    const t = text.trim()
    if (!t || !canSend) return
    $messages.set([...$messages.get(), { id: `${Date.now()}`, role: 'user', content: t } as ChatMessage])
    setText('')
    try {
      await sendPrompt(sessionId, t)
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
    <div className="safe-bottom sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] border-t bg-card p-2">
      <div className="mx-auto flex max-w-[720px] items-end gap-2">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void onSend() }
          }}
          placeholder={gatewayState !== 'open' ? '未连接 gateway…' : '发送消息…'}
          rows={1}
          className="max-h-28 min-h-10 flex-1 resize-none rounded-2xl border bg-background px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        {isStreaming ? (
          <button
            onClick={() => void onStop()}
            disabled={!sessionId}
            className="h-10 rounded-full bg-red-600 px-5 text-sm font-semibold text-white disabled:opacity-40"
          >
            停止
          </button>
        ) : (
          <button
            onClick={() => void onSend()}
            disabled={!canSend}
            className="h-10 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
          >
            发送
          </button>
        )}
      </div>
      <div className="mx-auto max-w-[720px] px-1 pt-1 text-[11px] text-muted-foreground">
        WS: {gatewayState} {isStreaming ? '· 生成中…' : ''} {sessionId ? `· ${sessionId.slice(0, 8)}` : '· 新会话'}
      </div>
    </div>
  )
}
