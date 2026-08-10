import { NavLink } from 'react-router'

const tabs = [
  { to: '/', label: '聊天', icon: '◐' },
  { to: '/sessions', label: '会话', icon: '≡' },
  { to: '/kanban', label: '看板', icon: '▤' },
  { to: '/settings', label: '设置', icon: '◈' },
]

export default function BottomNav() {
  return (
    <nav className="safe-bottom sticky bottom-0 z-20 flex h-[56px] items-stretch border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      {tabs.map(t => (
        <NavLink
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] ${isActive ? 'font-semibold text-foreground' : 'text-muted-foreground'}`
          }
          end={t.to === '/'}
          key={t.to}
          to={t.to}
        >
          <span className="text-[16px] leading-none">{t.icon}</span>
          <span>{t.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
