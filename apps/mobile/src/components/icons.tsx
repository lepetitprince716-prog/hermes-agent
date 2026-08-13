import type { ReactNode, SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Icon({ size = 18, children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  )
}

export function IconMessage(p: IconProps) {
  return <Icon {...p}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></Icon>
}
export function IconFolder(p: IconProps) {
  return <Icon {...p}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></Icon>
}
export function IconKanban(p: IconProps) {
  return <Icon {...p}><rect x="3" y="3" width="7" height="18" rx="1" /><rect x="14" y="3" width="7" height="10" rx="1" /></Icon>
}
export function IconChart(p: IconProps) {
  return <Icon {...p}><path d="M3 3v18h18" /><path d="M7 14v4" /><path d="M12 10v8" /><path d="M17 6v12" /></Icon>
}
export function IconSessions(p: IconProps) {
  return <Icon {...p}><path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" /><path d="M3 6h.01" /><path d="M3 12h.01" /><path d="M3 18h.01" /></Icon>
}
export function IconSettings(p: IconProps) {
  return (
    <Icon {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Icon>
  )
}
export function IconChevronDown(p: IconProps) {
  return <Icon size={14} {...p}><path d="M6 9l6 6 6-6" /></Icon>
}
export function IconArrowUp(p: IconProps) {
  return <Icon size={16} {...p}><path d="M12 19V5" /><path d="M5 12l7-7 7 7" /></Icon>
}
export function IconStop(p: IconProps) {
  return (
    <svg width={p.size ?? 12} height={p.size ?? 12} viewBox="0 0 12 12" fill="currentColor" aria-hidden {...p}>
      <rect x="1.5" y="1.5" width="9" height="9" rx="1.5" />
    </svg>
  )
}
export function IconCheck(p: IconProps) {
  return <Icon size={16} {...p}><path d="M20 6L9 17l-5-5" /></Icon>
}
export function IconMenu(p: IconProps) {
  return <Icon size={16} {...p}><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" /></Icon>
}
export function IconPlus(p: IconProps) {
  return <Icon size={16} {...p}><path d="M12 5v14" /><path d="M5 12h14" /></Icon>
}
