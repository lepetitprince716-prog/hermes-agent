import { useStore } from '@nanostores/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'

import { gatewayRequest } from '@/lib/gateway'
import { cn, formatRelativeTime } from '@/lib/utils'
import { $sessions, $sessionsSorted, type SessionInfo, sessionTitle } from '@/store/app'

function extractSessions(res: unknown): SessionInfo[] {
  if (!res || typeof res !== 'object') {return []}
  const r = res as Record<string, unknown>
  const cand = (r.sessions ?? r.items ?? r.data ?? r.list) as unknown

  if (Array.isArray(cand)) {return cand as SessionInfo[]}

  if (r.result && typeof r.result === 'object') {return extractSessions(r.result)}

  return []
}

/** 置顶是本地状态（gateway 无 pin RPC，desktop 置顶也是本地） */
const PIN_KEY = 'hermes-mobile-pinned-sessions'

function loadPins(): string[] {
  try {
    const raw = localStorage.getItem(PIN_KEY)
    const arr = raw ? JSON.parse(raw) : []

    return Array.isArray(arr) ? arr.filter(x => typeof x === 'string') : []
  } catch {
    return []
  }
}

export default function SessionsPage() {
  const navigate = useNavigate()
  const sessions = useStore($sessionsSorted)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [pins, setPins] = useState<string[]>(loadPins)

  const refresh = useCallback(async () => {
    setLoading(true); setErr(null)

    try {
      const res = await gatewayRequest('session.list', {})
      const list = extractSessions(res)

      if (list.length) {$sessions.set(list)}
      else if (Array.isArray(res)) {$sessions.set(res as SessionInfo[])}
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const togglePin = useCallback((id: string) => {
    setPins(prev => {
      const next = prev.includes(id) ? prev.filter(p => p !== id) : [id, ...prev]
      localStorage.setItem(PIN_KEY, JSON.stringify(next))

      return next
    })
  }, [])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()

    const filtered = q
      ? sessions.filter(s =>
          sessionTitle(s).toLowerCase().includes(q)
          || s.id.toLowerCase().includes(q)
          || (s.preview ?? '').toLowerCase().includes(q))
      : sessions

    // 置顶在前（保持 pins 数组顺序），其余按更新时间
    return [
      ...pins.map(id => filtered.find(s => s.id === id)).filter((s): s is SessionInfo => !!s),
      ...filtered.filter(s => !pins.includes(s.id)),
    ]
  }, [sessions, query, pins])

  const onNew = useCallback(async () => {
    // 新会话：直接跳到根的 Chat，首条消息会自动创建 session
    navigate('/')
  }, [navigate])

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-2 border-b bg-card px-3 py-2">
        <button className="shrink-0 rounded-full border bg-muted px-3 py-1.5 text-xs font-medium disabled:opacity-40" disabled={loading} onClick={() => void refresh()}>
          {loading ? '刷新中…' : '刷新'}
        </button>
        <button className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground" onClick={() => void onNew()}>
          ＋ 新会话
        </button>
        {err ? <span className="truncate text-xs text-red-500">{err}</span> : null}
      </div>

      <div className="border-b bg-card px-3 py-2">
        <input
          className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          onChange={e => setQuery(e.target.value)}
          placeholder="搜索会话…"
          value={query}
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {visible.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            {loading ? '加载中…' : query ? '没有匹配的会话' : '暂无会话，去新建一个吧'}
          </div>
        ) : (
          <ul className="divide-y">
            {visible.map(s => {
              const pinned = pins.includes(s.id)

              return (
                <li className="flex items-center" key={s.id}>
                  <button
                    className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3 text-left hover:bg-muted/50"
                    onClick={() => navigate(`/s/${s.id}`)}
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                      {(s.title?.[0] ?? s.preview?.[0] ?? '·').toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {pinned ? '📌 ' : ''}{sessionTitle(s)}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {s.preview?.slice(0, 80) ?? s.id.slice(0, 12)} · {formatRelativeTime(s.updated_at ?? s.created_at)}
                      </div>
                    </span>
                  </button>
                  <button
                    aria-label={pinned ? '取消置顶' : '置顶'}
                    className={cn(
                      'mr-3 shrink-0 rounded-full border px-2.5 py-1.5 text-xs',
                      pinned ? 'border-primary bg-primary/10' : 'bg-muted text-muted-foreground',
                    )}
                    onClick={() => togglePin(s.id)}
                  >
                    {pinned ? '已置顶' : '置顶'}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
