import { useCallback, useEffect, useState } from 'react'

import { gatewayRequest } from '@/lib/gateway'
import { cn } from '@/lib/utils'

/**
 * 全局 clarify/approval 应答弹窗。
 * gateway.ts 的 handleEvent 把 clarify.request / approval.request 等事件
 * 转成 `hermes:prompt` CustomEvent —— 这里接住并展示底部 sheet。
 *
 * 应答 RPC（照抄 desktop）：
 * - clarify.request → clarify.respond {request_id, answer}（空串=跳过，allow_expired）
 * - approval.request → approval.respond {choice: 'allow'|'deny', session_id}
 * - sudo/secret v1 不支持，提示去桌面端处理（不发明 API）
 */

type PromptDetail = {
  type: string
  label: string
  question: string
  payload: Record<string, unknown>
  sessionId?: string
}

function requestIdOf(p: Record<string, unknown>): string | null {
  const id = (p.request_id ?? p.requestId ?? p.id) as string | undefined

  return typeof id === 'string' && id ? id : null
}

function choicesOf(p: Record<string, unknown>): string[] {
  const raw = p.choices

  if (!Array.isArray(raw)) {return []}

  return raw.filter((c): c is string => typeof c === 'string' && c.length > 0)
}

export function PromptSheet() {
  const [req, setReq] = useState<PromptDetail | null>(null)
  const [freeText, setFreeText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    const onPrompt = (e: Event) => {
      const d = (e as CustomEvent).detail as PromptDetail

      if (!d?.type) {return}
      setReq(d)
      setFreeText('')
      setErr(null)
    }

    window.addEventListener('hermes:prompt', onPrompt as EventListener)

    return () => window.removeEventListener('hermes:prompt', onPrompt as EventListener)
  }, [])

  const answerClarify = useCallback(async (answer: string) => {
    if (!req) {return}
    const rid = requestIdOf(req.payload)

    if (!rid) { setErr('缺少 request_id，无法应答');

 return }

    setBusy(true)
    setErr(null)

    try {
      await gatewayRequest('clarify.respond', { request_id: rid, answer })
      setReq(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [req])

  const answerApproval = useCallback(async (choice: 'allow' | 'deny') => {
    if (!req) {return}
    setBusy(true)
    setErr(null)

    try {
      await gatewayRequest('approval.respond', { choice, session_id: req.sessionId ?? undefined })
      setReq(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [req])

  if (!req) {return null}

  const isClarify = req.type === 'clarify.request'
  const isApproval = req.type === 'approval.request'
  const supported = isClarify || isApproval
  const choices = choicesOf(req.payload)

  return (
    <div aria-modal="true" className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog">
      <div className="absolute inset-0 bg-black/40" onClick={() => !busy && setReq(null)} />
      <div className="safe-bottom relative rounded-t-2xl border-t bg-card shadow-xl">
        <div className="border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <span className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-semibold',
              isApproval ? 'bg-red-500/15 text-red-600 dark:text-red-400' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
            )}>
              {req.label}
            </span>
            {req.sessionId ? <span className="font-mono text-[10px] text-muted-foreground">{req.sessionId.slice(0, 12)}</span> : null}
          </div>
        </div>
        <div className="max-h-[60dvh] overflow-y-auto px-4 py-3">
          <div className="whitespace-pre-wrap text-[14px] leading-relaxed">{req.question}</div>

          {err ? <div className="mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-500">{err}</div> : null}

          {!supported ? (
            <div className="mt-3 rounded-lg bg-muted px-3 py-2.5 text-xs text-muted-foreground">
              此类请求（{req.type}）移动端暂不支持应答，请去桌面端处理。此弹窗不会阻塞桌面端应答。
            </div>
          ) : isApproval ? (
            <div className="mt-4 flex gap-2">
              <button
                className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
                disabled={busy}
                onClick={() => void answerApproval('allow')}
              >
                允许
              </button>
              <button
                className="flex-1 rounded-xl border bg-muted py-2.5 text-sm font-semibold disabled:opacity-40"
                disabled={busy}
                onClick={() => void answerApproval('deny')}
              >
                拒绝
              </button>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {choices.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  {choices.map(c => (
                    <button
                      className="rounded-xl border bg-muted px-3 py-2.5 text-left text-sm font-medium active:bg-muted/60 disabled:opacity-40"
                      disabled={busy}
                      key={c}
                      onClick={() => void answerClarify(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    autoFocus
                    className="min-w-0 flex-1 rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                    onChange={e => setFreeText(e.target.value)}
                    placeholder="输入回答…"
                    value={freeText}
                  />
                  <button
                    className="shrink-0 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-40"
                    disabled={busy || !freeText.trim()}
                    onClick={() => void answerClarify(freeText.trim())}
                  >
                    回答
                  </button>
                </div>
              )}
              <button
                className="w-full rounded-xl border bg-muted py-2 text-xs font-medium text-muted-foreground disabled:opacity-40"
                disabled={busy}
                onClick={() => void answerClarify('')}
              >
                跳过
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
