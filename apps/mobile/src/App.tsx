import { useState, useEffect } from 'react'
import { useStore } from '@nanostores/react'
import { NavLink, Routes, Route, useNavigate, useParams } from 'react-router'
import { $gatewayState, $sessions, $sessionsSorted, $selectedSessionId, $currentInstanceId } from '@/store/app'
import { connectGateway, ensureLiveness, gatewayRequest } from '@/lib/gateway'
import { findInstance, loadSavedInstance } from '@/lib/instances'
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

function InstanceChip() {
  const state = useStore($gatewayState)
  const instanceId = useStore($currentInstanceId)
  const inst = findInstance(instanceId)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs',
        state === 'open' ? 'bg-emerald-500/10 text-emerald-700' : 'bg-muted text-muted-foreground',
      )}
      title={inst.hint}
    >
      <span className={cn('size-1.5 rounded-full', state === 'open' ? 'bg-emerald-500' : 'bg-muted-foreground')} />
      {inst.label}
    </span>
  )
}

const rail = [
  { to: '/', label: '聊天', Icon: IconMessage, end: true },
  { to: '/projects', label: '项目', Icon: IconFolder },
  { to: '/kanban', label: '看板', Icon: IconKanban },
  { to: '/stats', label: '统计', Icon: IconChart },
  { to: '/sessions', label: '历史', Icon: IconSessions },
]

function SideRail() {
  const state = useStore($gatewayState)
  return (
    <aside className="hidden w-14 shrink-0 flex-col items-center border-r bg-white/60 py-4 md:flex">
      {rail.map(t => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          title={t.label}
          className={({ isActive }) =>
            cn(
              'mb-1 grid size-10 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
              isActive && 'bg-[#E8EFFC] text-primary',
            )
          }
        >
          <t.Icon size={18} />
        </NavLink>
      ))}
      <div className="mt-auto flex flex-col items-center gap-2">
        <NavLink
          to="/settings"
          title="设置"
          className={({ isActive }) =>
            cn(
              'relative grid size-10 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground',
              isActive && 'bg-[#E8EFFC] text-primary',
            )
          }
        >
          <IconSettings size={18} />
          <span
            className={cn(
              'absolute right-1.5 top-1.5 size-2 rounded-full',
              state === 'open' ? 'bg-emerald-500' : state === 'connecting' ? 'bg-amber-400' : 'bg-red-500',
            )}
          />
        </NavLink>
      </div>
    </aside>
  )
}

export default function App() {
  const [bootTried, setBootTried] = useState(false)

  useEffect(() => {
    if (bootTried) return
    setBootTried(true)
    $currentInstanceId.set(loadSavedInstance().id)
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
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <Routes>
            <Route path="/" element={<ChatRoute />} />
            <Route path="/s/:id" element={<ChatRoute />} />
            <Route path="/projects" element={<><TopBar title="项目" right={<InstanceChip />} /><ProjectsPage /></>} />
            <Route path="/projects/:projectId" element={<><TopBar title="文件" right={<InstanceChip />} /><FilesPage /></>} />
            <Route path="/kanban" element={<><TopBar title="看板" right={<InstanceChip />} /><KanbanPage /></>} />
            <Route path="/stats" element={<><TopBar title="统计" right={<InstanceChip />} /><StatsPage /></>} />
            <Route path="/sessions" element={<><TopBar title="历史" right={<InstanceChip />} /><SessionsPage /></>} />
            <Route path="/settings" element={<><TopBar title="设置" right={<InstanceChip />} /><SettingsPage /></>} />
            <Route path="*" element={<><TopBar title="Hermes" right={<InstanceChip />} /><ChatRoute /></>} />
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
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[15px] font-semibold transition-colors hover:bg-muted md:hidden"
          >
            <IconMenu />
            会话 {sessions.length ? `· ${sessions.length}` : ''}
          </button>
          <span className="hidden md:block" />
          <InstanceChip />
          <button
            onClick={() => navigate('/settings')}
            aria-label="设置"
            className="inline-flex items-center justify-center rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
          >
            <IconSettings size={16} />
          </button>
          <span className="hidden w-8 md:block" />
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
