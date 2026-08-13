import { useState, useEffect } from 'react'
import { useStore } from '@nanostores/react'
import { NavLink, Routes, Route, useNavigate, useParams } from 'react-router'
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
import { PromptSheet } from '@/components/PromptSheet'
import { IconChart, IconFolder, IconKanban, IconMenu, IconMessage, IconSessions, IconSettings } from '@/components/icons'
import { cn } from '@/lib/utils'

function TopBar({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="safe-top sticky top-0 z-10 bg-transparent">
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
    <span className="inline-flex items-center gap-1.5 px-1 py-1 text-xs text-muted-foreground" title={err ?? undefined}>
      <span className={cn('size-2 rounded-full', dot)} />
      {label}
    </span>
  )
}

const rail = [
  { to: '/', label: '聊天', Icon: IconMessage, end: true },
  { to: '/projects', label: '项目', Icon: IconFolder },
  { to: '/kanban', label: '看板', Icon: IconKanban },
  { to: '/stats', label: '统计', Icon: IconChart },
  { to: '/sessions', label: '会话', Icon: IconSessions },
  { to: '/settings', label: '设置', Icon: IconSettings },
]

function SideRail() {
  return (
    <aside className="hidden w-16 shrink-0 flex-col items-center py-4 md:flex">
      {rail.map(t => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          title={t.label}
          className={({ isActive }) =>
            cn(
              'mb-1 grid size-10 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
              isActive && 'bg-muted text-foreground',
            )
          }
        >
          <t.Icon size={18} />
        </NavLink>
      ))}
    </aside>
  )
}

export default function App() {
  const [bootTried, setBootTried] = useState(false)

  useEffect(() => {
    if (bootTried) return
    setBootTried(true)
    connectGateway().catch(() => {})
  }, [bootTried])

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
    <div className="flex min-h-dvh bg-background">
      <SideRail />
      <div className="flex min-w-0 flex-1 flex-col">
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
    </div>
  )
}

function ChatRoute() {
  const { id } = useParams()
  const navigate = useNavigate()
  const sessions = useStore($sessionsSorted)
  const sid = id ?? null

  useEffect(() => { $selectedSessionId.set(sid) }, [sid])

  useEffect(() => {
    const onSid = (e: Event) => {
      const detail = (e as CustomEvent).detail as { sessionId: string }
      if (detail?.sessionId && detail.sessionId !== sid) {
        gatewayRequest('session.list', {}).then((res: unknown) => {
          const list = extractSessions(res)
          if (list.length) $sessions.set(list)
        }).catch(() => {})
        if (!sid) navigate(`/s/${detail.sessionId}`, { replace: true })
      }
    }
    window.addEventListener('hermes:session-id', onSid as EventListener)
    return () => window.removeEventListener('hermes:session-id', onSid as EventListener)
  }, [sid, navigate])

  return (
    <>
      <div className="safe-top sticky top-0 z-10 bg-transparent">
        <div className="flex h-14 items-center justify-between px-3">
          <button
            onClick={() => navigate('/sessions')}
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
          >
            <IconMenu />
            会话 {sessions.length ? `· ${sessions.length}` : ''}
          </button>
          <div className="wordmark hidden text-[13px] text-midground md:block">Hermes</div>
          <GatewayBadge />
          <button
            onClick={() => navigate('/settings')}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
          >
            <IconSettings size={14} />
            设置
          </button>
          <span className="hidden w-16 md:block" />
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
