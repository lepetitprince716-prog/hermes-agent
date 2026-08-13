import { NavLink } from 'react-router'

import { IconChart, IconFolder, IconKanban, IconMessage, IconSessions, IconSettings } from '@/components/icons'

const tabs = [
  { to: '/', label: '聊天', Icon: IconMessage },
  { to: '/projects', label: '项目', Icon: IconFolder },
  { to: '/kanban', label: '看板', Icon: IconKanban },
  { to: '/stats', label: '统计', Icon: IconChart },
  { to: '/sessions', label: '会话', Icon: IconSessions },
  { to: '/settings', label: '设置', Icon: IconSettings },
]

export default function BottomNav() {
  return (
    <nav className="safe-bottom sticky bottom-0 z-20 bg-transparent md:hidden">
      <div className="flex h-14 items-stretch">
        {tabs.map(t => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.to === '/'}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] ${isActive ? 'font-semibold text-foreground' : 'text-muted-foreground'}`
            }
          >
            <t.Icon size={18} />
            <span>{t.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
