import { useStore } from '@nanostores/react'
import { useEffect, useState } from 'react'
import { Route, Routes, useNavigate, useParams } from 'react-router'

import BottomNav from '@/components/BottomNav'
import { PromptSheet } from '@/components/PromptSheet'
import { connectGateway, ensureLiveness, gatewayRequest } from '@/lib/gateway'
import { defaultDashboardUrl } from '@/lib/gateway-url'
import { cn } from '@/lib/utils'
import ChatPage from '@/pages/ChatPage'
import KanbanPage from '@/pages/KanbanPage'
import SessionsPage from '@/pages/SessionsPage'
import SettingsPage from '@/pages/SettingsPage'
import { $gatewayError, $gatewayState, $selectedSessionId, $sessions, $sessionsSorted, type SessionInfo } from '@/store/app'

function TopBar({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="safe-top sticky top-0 z-10 flex h-14 items-center justify-between border-b bg-card/80 px-4 backdrop-blur">
      <h1 className="text-[15px] font-semibold tracking-tight">{title}</h1>
      <div className="flex items-center gap-2">{right}</div>
    </div>
  )
}

function GatewayBadge() {
  const state = useStore($gatewayState)
  const err = useStore($gatewayError)
  const dot = state === 'open' ? 'bg-emerald-500' : state === 'connecting' ? 'bg-amber-400 animate-pulse' : 'bg-zinc-400'
  const label = state === 'open' ? '已连接' : state === 'connecting' ? '连接中' : state === 'error' ? '错误' : '未连接'

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted px-2.5 py-1 text-xs" title={err ?? undefined}>
      <span className={cn('size-2 rounded-full', dot)} />
      {label}
    </span>
  )
}

export default function App() {
  const [bootTried, setBootTried] = useState(false)

  // auto-connect on mount
  useEffect(() => {
    if (bootTried) {return}
    setBootTried(true)
    const url = defaultDashboardUrl()
    connectGateway(url).catch(() => {})
  }, [bootTried])

  // 前台恢复探活：iOS 后台杀 socket 后回前台立即验证/重连
  useEffect(() => {
    const onActive = () => {
      if (document.visibilityState === 'visible') {ensureLiveness()}
    }

    document.addEventListener('visibilitychange', onActive)
    window.addEventListener('focus', onActive)
    window.addEventListener('pageshow', onActive)

    return () => {
      document.removeEventListener('visibilitychange', onActive)
      window.removeEventListener('focus', onActive)
      window.removeEventListener('pageshow', onActive)
    }
  }, [])

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <div className="flex flex-1 flex-col">
        <Routes>
          <Route element={<ChatRoute />} path="/" />
          <Route element={<ChatRoute />} path="/s/:id" />
          <Route element={<><TopBar right={<GatewayBadge />} title="会话" /><SessionsPage /></>} path="/sessions" />
          <Route element={<><TopBar right={<GatewayBadge />} title="看板" /><KanbanPage /></>} path="/kanban" />
          <Route element={<><TopBar right={<GatewayBadge />} title="设置" /><SettingsPage /></>} path="/settings" />
          <Route element={<><TopBar right={<GatewayBadge />} title="Hermes" /><ChatRoute /></>} path="*" />
        </Routes>
      </div>
      <BottomNav />
      <PromptSheet />
    </div>
  )
}

function ChatRoute() {
  const { id } = useParams()
  const navigate = useNavigate()
  const sessions = useStore($sessionsSorted)
  const sid = id ?? null

  // sync selectedSessionId with route
  useEffect(() => { $selectedSessionId.set(sid) }, [sid])

  // when gateway emits session-id, navigate to it (新会话落地)
  useEffect(() => {
    const onSid = (e: Event) => {
      const detail = (e as CustomEvent).detail as { sessionId: string }

      if (detail?.sessionId && detail.sessionId !== sid) {
        // 刷新列表并切路由
        gatewayRequest('session.list', {}).then((res: unknown) => {
          const list = extractSessions(res)

          if (list.length) {$sessions.set(list)}
        }).catch(() => {})

        // 只有在根路径才自动跳转，避免覆盖用户已选会话
        if (!sid) {navigate(`/s/${detail.sessionId}`, { replace: true })}
      }
    }

    window.addEventListener('hermes:session-id', onSid as EventListener)

    return () => window.removeEventListener('hermes:session-id', onSid as EventListener)
  }, [sid, navigate])

  return (
    <>
      <div className="safe-top sticky top-0 z-10 flex h-14 items-center justify-between border-b bg-card/80 px-3 backdrop-blur">
        <button
          className="rounded-full border bg-muted px-3 py-1.5 text-xs font-medium"
          onClick={() => navigate('/sessions')}
        >
          ☰ 会话 {sessions.length ? `· ${sessions.length}` : ''}
        </button>
        <GatewayBadge />
        <button className="rounded-full border bg-muted px-3 py-1.5 text-xs font-medium" onClick={() => navigate('/settings')}>
          设置
        </button>
      </div>
      <ChatPage sessionId={sid} />
    </>
  )
}

function extractSessions(res: unknown): SessionInfo[] {
  if (!res || typeof res !== 'object') {return []}
  const r = res as Record<string, unknown>
  const cand = (r.sessions ?? r.items ?? r.data ?? r.list) as unknown

  if (Array.isArray(cand)) {return cand as SessionInfo[]}

  if (r.result && typeof r.result === 'object') {return extractSessions(r.result)}

  return []
}
