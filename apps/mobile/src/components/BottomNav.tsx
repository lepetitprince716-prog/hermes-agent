import { NavLink } from 'react-router'

import { IconChart, IconFolder, IconKanban, IconMessage, IconSessions } from '@/components/icons'

const tabs = [
  { to: '/', label: '聊天', Icon: IconMessage },
  { to: '/projects', label: '项目', Icon: IconFolder },
  { to: '/kanban', label: '看板', Icon: IconKanban },
  { to: '/stats', label: '统计', Icon: IconChart },
  { to: '/sessions', label: '历史', Icon: IconSessions },
]

export default function BottomNav() {
  return (
    <nav className="safe-bottom sticky bottom-0 z-20 border-t bg-background/90 backdrop-blur md:hidden">
      <div className="flex h-14 items-stretch">
        {tabs.map(t => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.to === '/'}
            className={({ isActive }) =>
              `relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive ? <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-primary" /> : null}
                <t.Icon size={18} />
                <span>{t.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
