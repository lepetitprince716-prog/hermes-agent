import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { useStore } from '@nanostores/react'
import { $sessions, $sessionsSorted, sessionTitle, type SessionInfo } from '@/store/app'
import { gatewayRequest } from '@/lib/gateway'
import { formatRelativeTime } from '@/lib/utils'

function extractSessions(res: unknown): SessionInfo[] {
  if (!res || typeof res !== 'object') return []
  const r = res as Record<string, unknown>
  const cand = (r.sessions ?? r.items ?? r.data ?? r.list) as unknown
  if (Array.isArray(cand)) return cand as SessionInfo[]
  if (r.result && typeof r.result === 'object') return extractSessions(r.result)
  return []
}

export default function SessionsPage() {
  const navigate = useNavigate()
  const sessions = useStore($sessionsSorted)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true); setErr(null)
    try {
      const res = await gatewayRequest('session.list', {})
      const list = extractSessions(res)
      if (list.length) $sessions.set(list)
      else if (Array.isArray(res)) $sessions.set(res as SessionInfo[])
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const onNew = useCallback(async () => {
    // 新会话：直接跳到根的 Chat，首条消息会自动创建 session
    navigate('/')
  }, [navigate])

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-2 border-b bg-card px-3 py-2">
        <button onClick={() => void refresh()} disabled={loading} className="rounded-full border bg-muted px-3 py-1.5 text-xs font-medium disabled:opacity-40">
          {loading ? '刷新中…' : '刷新'}
        </button>
        <button onClick={() => void onNew()} className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
          ＋ 新会话
        </button>
        {err ? <span className="truncate text-xs text-red-500">{err}</span> : null}
      </div>

      <div className="flex-1 overflow-y-auto">
        {sessions.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            {loading ? '加载中…' : '暂无会话，去新建一个吧'}
          </div>
        ) : (
          <ul className="divide-y">
            {sessions.map(s => (
              <li key={s.id}>
                <button
                  onClick={() => navigate(`/s/${s.id}`)}
                  className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-muted/50"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                    {(s.title?.[0] ?? s.preview?.[0] ?? '·').toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{sessionTitle(s)}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {s.preview?.slice(0, 80) ?? s.id.slice(0, 12)} · {formatRelativeTime(s.updated_at ?? s.created_at)}
                    </div>
                  </span>
                  <span className="shrink-0 text-muted-foreground">›</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
