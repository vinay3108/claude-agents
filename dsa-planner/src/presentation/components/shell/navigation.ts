import type { LucideIcon } from 'lucide-react'
import {
  CodeXml,
  LayoutDashboard,
  MessagesSquare,
  NotebookPen,
  Settings,
  Sparkles,
  Waypoints,
} from 'lucide-react'

export interface NavItem {
  readonly href: string
  readonly label: string
  readonly icon: LucideIcon
}

export interface NavSection {
  readonly title: string
  readonly items: readonly NavItem[]
}

export const NAV_SECTIONS: readonly NavSection[] = [
  {
    title: 'Track',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/recommendations', label: 'Recommendations', icon: Sparkles },
      { href: '/notes', label: 'Notes', icon: NotebookPen },
    ],
  },
  {
    title: 'Practice',
    items: [
      { href: '/coach', label: 'AI Coach', icon: MessagesSquare },
      { href: '/interview', label: 'Interview', icon: CodeXml },
      { href: '/system-design', label: 'System Design', icon: Waypoints },
    ],
  },
  {
    title: 'Account',
    items: [{ href: '/settings', label: 'Settings', icon: Settings }],
  },
]

/** True when `pathname` is `href` itself or a page nested under it. */
export function isNavItemActive(pathname: string, href: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  return path === href || path.startsWith(`${href}/`)
}
