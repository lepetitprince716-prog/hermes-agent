import { useState, useEffect } from 'react'
import { useStore } from '@nanostores/react'
import { Routes, Route, useNavigate, useParams } from 'react-router'
import { $gatewayState, $gatewayError, $sessions, $sessionsSorted, $selectedSessionId } from '@/store/app'
import { connectGateway, ensureLiveness, gatewayRequest } from '@/lib/gateway'
import ChatPage from '@/pages/ChatPage'
import FilesPage from '@/pages/FilesPage'
import KanbanPage from '@/pages/KanbanPage'
import ProjectsPage from '@/pages/ProjectsPage'
import SessionsPage from '@/pages/SessionsPage'
import SettingsPage from '@/pages/SettingsPage'
import StatsPage from '@/pages/StatsPage'
import BottomNav from '@/components/BottomNav'
import { ModelPicker } from '@/components/ModelPicker'
import { PromptSheet } from '@/components/PromptSheet'
import { cn } from '@/lib/utils'

function TopBar({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="safe-top sticky top-0 z-10 border-b bg-card/80 backdrop-blur">
      <div className="flex h-14 items-center justify-between px-4">
        <h1 className="text-[15px] font-semibold tracking-tight">{title}</h1>
        <div className="flex items-center gap-2">{right}</div>
      </div>
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
    if (bootTried) return
    setBootTried(true)
    connectGateway().catch(() => {})
  }, [bootTried])

  // iOS 僵尸连接：回前台探活。WKWebView 后台可能静默杀 socket 且不发 close。
  useEffect(() => {
    const onForeground = () => { void ensureLiveness().catch(() => {}) }
    document.addEventListener('visibilitychange', onForeground)
    window.addEventListener('focus', onForeground)
    window.addEventListener('pageshow', onForeground)
    return () => {
      document.removeEventListener('visibilitychange', onForeground)
      window.removeEventListener('focus', onForeground)
      window.removeEventListener('pageshow', onForeground)
    }
  }, [])

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <div className="flex flex-1 flex-col">
        <Routes>
          <Route path="/" element={<ChatRoute />} />
          <Route path="/s/:id" element={<ChatRoute />} />
          <Route path="/projects" element={<><TopBar title="项目" right={<GatewayBadge />} /><ProjectsPage /></>} />
          <Route path="/projects/:projectId" element={<><TopBar title="文件" right={<GatewayBadge />} /><FilesPage /></>} />
          <Route path="/kanban" element={<><TopBar title="看板" right={<GatewayBadge />} /><KanbanPage /></>} />
          <Route path="/stats" element={<><TopBar title="统计" right={<GatewayBadge />} /><StatsPage /></>} />
          <Route path="/sessions" element={<><TopBar title="会话" right={<GatewayBadge />} /><SessionsPage /></>} />
          <Route path="/settings" element={<><TopBar title="设置" right={<GatewayBadge />} /><SettingsPage /></>} />
          <Route path="*" element={<><TopBar title="Hermes" right={<GatewayBadge />} /><ChatRoute /></>} />
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
          if (list.length) $sessions.set(list)
        }).catch(() => {})
        // 只有在根路径才自动跳转，避免覆盖用户已选会话
        if (!sid) navigate(`/s/${detail.sessionId}`, { replace: true })
      }
    }
    window.addEventListener('hermes:session-id', onSid as EventListener)
    return () => window.removeEventListener('hermes:session-id', onSid as EventListener)
  }, [sid, navigate])

  return (
    <>
      <div className="safe-top sticky top-0 z-10 border-b bg-card/80 backdrop-blur">
        <div className="flex h-14 items-center justify-between px-3">
          <button
            onClick={() => navigate('/sessions')}
            className="rounded-full border bg-muted px-3 py-1.5 text-xs font-medium"
          >
            ☰ 会话 {sessions.length ? `· ${sessions.length}` : ''}
          </button>
          <GatewayBadge />
          <ModelPicker sessionId={sid} />
        </div>
      </div>
      <ChatPage sessionId={sid} />
    </>
  )
}

function extractSessions(res: unknown): import('@/store/app').SessionInfo[] {
  if (!res || typeof res !== 'object') return []
  const r = res as Record<string, unknown>
  const cand = (r.sessions ?? r.items ?? r.data ?? r.list) as unknown
  if (Array.isArray(cand)) return cand as import('@/store/app').SessionInfo[]
  if (r.result && typeof r.result === 'object') return extractSessions(r.result)
  return []
}
